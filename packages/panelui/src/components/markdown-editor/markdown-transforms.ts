/**
 * The edits a formatting toolbar makes, as functions of the text and where the
 * caret is in it.
 *
 * Pure, and deliberately so. Every one of these takes `(text, selection)` and
 * returns the text that should replace it together with where the selection
 * should end up — no component, no ref, no input. What makes a formatting
 * toolbar feel broken is never the characters it inserts; it is where the caret
 * lands afterwards, and that is a property of these functions rather than of
 * the field they are wired to.
 *
 * Three rules they all keep:
 *
 * - **Applying twice undoes it.** A toolbar button that only ever adds is a
 *   button you can press once, and every press after that damages the text.
 * - **A selection stays selected.** Bolding three words and then italicising
 *   the same three has to be two presses, not a press and a re-selection.
 * - **With nothing selected, the caret lands where the writing goes** — between
 *   the new markers rather than after them.
 */

export interface EditorSelection {
  start: number;
  end: number;
}

export interface EditResult {
  text: string;
  selection: EditorSelection;
}

/** Clamps a selection to the text it belongs to, and puts it the right way round. */
function normalise(text: string, selection: EditorSelection): EditorSelection {
  const a = Math.max(0, Math.min(text.length, selection.start));
  const b = Math.max(0, Math.min(text.length, selection.end));
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/* -------------------------------------------------------------------------- *
 * Inline markers — bold, italic, inline code
 * -------------------------------------------------------------------------- */

/**
 * Wraps the selection in `marker`, or unwraps it if it is already wrapped.
 *
 * "Already wrapped" is checked both ways round: the markers may be inside the
 * selection (the writer selected `**bold**`) or immediately outside it (they
 * selected `bold` in the middle of `**bold**`). Both are the same intent, and a
 * toolbar that only recognised one of them would add a second pair of asterisks
 * to text that already had them.
 */
export function toggleWrap(
  text: string,
  selection: EditorSelection,
  marker: string
): EditResult {
  const { start, end } = normalise(text, selection);
  const selected = text.slice(start, end);
  const len = marker.length;

  // The markers are inside the selection.
  if (
    selected.length >= len * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(len, selected.length - len);
    return {
      text: text.slice(0, start) + inner + text.slice(end),
      selection: { start, end: start + inner.length },
    };
  }

  // The markers are just outside it.
  const before = text.slice(Math.max(0, start - len), start);
  const after = text.slice(end, end + len);
  if (before === marker && after === marker) {
    return {
      text: text.slice(0, start - len) + selected + text.slice(end + len),
      selection: { start: start - len, end: end - len + selected.length },
    };
  }

  /*
   * A selection that crosses a line break is wrapped line by line.
   *
   * `**one\ntwo**` is not bold in any reader — an inline marker cannot span a
   * paragraph break — so wrapping the whole span produces asterisks the writer
   * can see and no emphasis they asked for. Each line gets its own pair, and
   * blank lines are left alone rather than given an empty pair of markers.
   */
  if (selected.includes('\n')) {
    const wrapped = selected
      .split('\n')
      .map((line) => (line.trim() === '' ? line : marker + line + marker))
      .join('\n');
    const next = text.slice(0, start) + wrapped + text.slice(end);
    return { text: next, selection: { start, end: start + wrapped.length } };
  }

  const next = text.slice(0, start) + marker + selected + marker + text.slice(end);

  // Nothing selected: the caret goes between the markers, which is where the
  // writer is about to type. Something selected: it stays selected.
  return selected
    ? { text: next, selection: { start: start + len, end: end + len } }
    : { text: next, selection: { start: start + len, end: start + len } };
}

/* -------------------------------------------------------------------------- *
 * Line prefixes — headings, lists, quotes
 * -------------------------------------------------------------------------- */

/** The span of whole lines the selection touches, even partly. */
function lineRange(text: string, selection: EditorSelection): EditorSelection {
  const { start, end } = normalise(text, selection);
  const from = text.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = text.indexOf('\n', end);
  return { start: from, end: lineEnd === -1 ? text.length : lineEnd };
}

/**
 * Replaces the text between two offsets and reports where the selection goes.
 *
 * The selection is kept over the same *lines* rather than the same character
 * offsets — prefixing four lines moves everything after the first one along,
 * and a selection that did not move with them would end up covering a different
 * four lines than the ones just changed.
 */
function replaceBlock(
  text: string,
  range: EditorSelection,
  replacement: string
): EditResult {
  return {
    text: text.slice(0, range.start) + replacement + text.slice(range.end),
    selection: { start: range.start, end: range.start + replacement.length },
  };
}

/**
 * The same replacement, with the caret left where the writer's was.
 *
 * A line-level action applies to whole lines, but the writer's caret was in the
 * middle of one of them, and handing back the whole block selected means the
 * next thing they type replaces the list they just made. So the caret is put
 * back at the same distance from the start of the block, shifted by however
 * much the text before it grew.
 */
function replaceBlockKeepingCaret(
  text: string,
  range: EditorSelection,
  replacement: string,
  selection: EditorSelection
): EditResult {
  const next = text.slice(0, range.start) + replacement + text.slice(range.end);
  const { start, end } = normalise(text, selection);

  // A real selection is kept as a selection over the same lines; only a caret
  // is followed precisely.
  if (start !== end) {
    return { text: next, selection: { start: range.start, end: range.start + replacement.length } };
  }

  const before = text.slice(range.start, start);
  const line = before.split('\n').length - 1;
  const column = before.length - (before.lastIndexOf('\n') + 1);

  const oldLines = text.slice(range.start, range.end).split('\n');
  const newLines = replacement.split('\n');
  const index = Math.min(line, newLines.length - 1);
  const oldLine = oldLines[Math.min(line, oldLines.length - 1)] ?? '';
  const newLine = newLines[index] ?? '';

  /*
   * The caret keeps its distance from the *end* of its line, not from the
   * start of it.
   *
   * These actions change what is in front of the text: a caret held at the
   * same column ends up inside the bullet it just gained, and after removing
   * one it ends up two characters into the word. The distance to the end of
   * the line is the thing a prefix cannot move.
   */
  const fromEnd = Math.max(0, oldLine.length - column);
  const nextColumn = Math.max(0, newLine.length - fromEnd);

  const offsetToLine = newLines
    .slice(0, index)
    .reduce((total, each) => total + each.length + 1, 0);

  const at = range.start + offsetToLine + Math.min(nextColumn, newLine.length);
  return { text: next, selection: { start: at, end: at } };
}

/**
 * Puts `prefix` on the front of every line the selection touches, or takes it
 * off if every one of them already has it.
 *
 * Every one, not any one: a mixed block is a block the writer is trying to make
 * uniform, so the useful answer there is to add rather than to remove.
 */
export function toggleLinePrefix(
  text: string,
  selection: EditorSelection,
  prefix: string
): EditResult {
  const range = lineRange(text, selection);
  const lines = text.slice(range.start, range.end).split('\n');
  const has = (line: string) => line.startsWith(prefix);
  const next = lines.every(has)
    ? lines.map((line) => line.slice(prefix.length))
    : lines.map((line) => (has(line) ? line : prefix + line));

  return replaceBlockKeepingCaret(text, range, next.join('\n'), selection);
}

/** How an ordered-list line starts, so it can be recognised and removed. */
const ORDERED = /^\d+\.\s/;

/**
 * Numbers the lines the selection touches, or unnumbers them.
 *
 * Counted from one within the block rather than continuing whatever came above
 * it: the numbers a writer types are not the numbers that get rendered — every
 * markdown reader renumbers an ordered list from its first item — so the useful
 * thing is for the source to read the way the output will.
 */
export function toggleOrderedList(
  text: string,
  selection: EditorSelection
): EditResult {
  const range = lineRange(text, selection);
  const lines = text.slice(range.start, range.end).split('\n');
  const next = lines.every((line) => ORDERED.test(line))
    ? lines.map((line) => line.replace(ORDERED, ''))
    : lines.map((line, i) => `${i + 1}. ${line.replace(ORDERED, '')}`);

  return replaceBlockKeepingCaret(text, range, next.join('\n'), selection);
}

/* -------------------------------------------------------------------------- *
 * Links
 * -------------------------------------------------------------------------- */

/** Placeholder left where a link's target goes. */
export const LINK_PLACEHOLDER = 'url';

/**
 * Turns the selection into a link, and selects the part that still needs
 * filling in.
 *
 * Which part that is depends on what was selected. With text selected, the
 * label is written and the target is not, so the placeholder target is left
 * selected and typing replaces it. With nothing selected there is neither, and
 * the label comes first because it is the half the writer is thinking about.
 */
export function insertLink(text: string, selection: EditorSelection): EditResult {
  const { start, end } = normalise(text, selection);
  const label = text.slice(start, end);
  const inserted = `[${label}](${LINK_PLACEHOLDER})`;
  const next = text.slice(0, start) + inserted + text.slice(end);

  if (label) {
    const from = start + label.length + 3; // `[` + label + `](`
    return { text: next, selection: { start: from, end: from + LINK_PLACEHOLDER.length } };
  }

  return { text: next, selection: { start: start + 1, end: start + 1 } };
}

/* -------------------------------------------------------------------------- *
 * Fenced code
 * -------------------------------------------------------------------------- */

/**
 * Puts the selected lines in a fence, or takes them out of one.
 *
 * A fence is the one construct that has to sit on lines of its own, so this
 * makes room for itself: a blank line before it when it is not already at the
 * start of a paragraph, and one after it at the end.
 */
/**
 * The whole fenced block the selection is inside, or `null`.
 *
 * Scanned from the top of the document rather than read off the lines the
 * selection touches, because a caret sitting on a line of code touches one
 * line and that line says nothing about the fence around it. Without this,
 * pressing the code button inside a fence wrapped it in a second one.
 */
function enclosingFence(
  text: string,
  selection: EditorSelection
): EditorSelection | null {
  const { start, end } = normalise(text, selection);
  let offset = 0;
  let openedAt: number | null = null;

  for (const line of text.split('\n')) {
    const lineStart = offset;
    const lineEnd = offset + line.length;

    if (line.startsWith('```')) {
      if (openedAt === null) openedAt = lineStart;
      else {
        if (start >= openedAt && end <= lineEnd) return { start: openedAt, end: lineEnd };
        openedAt = null;
      }
    }

    offset = lineEnd + 1;
  }

  return null;
}

export function toggleFence(text: string, selection: EditorSelection): EditResult {
  const enclosing = enclosingFence(text, selection);
  if (enclosing) {
    const inner = text
      .slice(enclosing.start, enclosing.end)
      .split('\n')
      .slice(1, -1)
      .join('\n');
    return replaceBlock(text, enclosing, inner);
  }

  const range = lineRange(text, selection);
  const block = text.slice(range.start, range.end);

  const leadIn = range.start > 0 && text[range.start - 1] !== '\n' ? '\n' : '';
  // And a blank line after it, unless the fence already ends the document or
  // the line below it is blank. A paragraph butted up against a closing fence
  // is a paragraph some readers swallow into the code block.
  const rest = text.slice(range.end);
  const leadOut = rest === '' || rest.startsWith('\n\n') ? '' : '\n';

  const opener = `${leadIn}\`\`\`\n`;
  const fenced = `${opener}${block}\n\`\`\`${leadOut}`;
  const result = replaceBlock(text, range, fenced);

  // Inside the fence, on the line the code goes on — not around the whole
  // block, which would be selecting the markers along with the content. The
  // offset is the opener's own length rather than a written-down number, so it
  // cannot drift from the string above it.
  const inner = range.start + opener.length;
  return { text: result.text, selection: { start: inner, end: inner + block.length } };
}

/* -------------------------------------------------------------------------- *
 * Images
 * -------------------------------------------------------------------------- */

/** Placeholder left where an image's description goes. */
export const IMAGE_PLACEHOLDER = 'description';

/**
 * Inserts an image, and selects the part that still needs filling in.
 *
 * The description first, not the URL. An image with no alt text is the failure
 * that actually happens, and the writer is far more likely to have the URL on
 * the clipboard than the sentence describing what is in it — so the sentence is
 * what the caret is left on.
 */
export function insertImage(text: string, selection: EditorSelection): EditResult {
  const { start, end } = normalise(text, selection);
  const label = text.slice(start, end);
  const alt = label || IMAGE_PLACEHOLDER;
  const inserted = `![${alt}](${LINK_PLACEHOLDER})`;
  const next = text.slice(0, start) + inserted + text.slice(end);

  // With a description already written, what is missing is the target.
  if (label) {
    const from = start + label.length + 4; // `![` + label + `](`
    return { text: next, selection: { start: from, end: from + LINK_PLACEHOLDER.length } };
  }

  const from = start + 2; // `![`
  return { text: next, selection: { start: from, end: from + alt.length } };
}

/* -------------------------------------------------------------------------- *
 * Continuing a list
 * -------------------------------------------------------------------------- */

/** A bullet line, and how much of it is the marker. */
const BULLET = /^(\s*)([-*+])(\s+)(.*)$/;
/** A numbered line, split the same way. */
const NUMBERED = /^(\s*)(\d+)\.(\s+)(.*)$/;

/**
 * What Return should do inside a list.
 *
 * Returns `null` when the caret is not on a list line, which is the signal to
 * let the newline happen normally. Otherwise it either starts the next item or,
 * on an item with nothing in it, ends the list — because a writer pressing
 * Return on an empty bullet is telling you they have run out of items, and the
 * alternative is a trail of empty bullets they have to delete by hand.
 */
export function continueList(
  text: string,
  selection: EditorSelection
): EditResult | null {
  const { start, end } = normalise(text, selection);
  // Only a caret continues a list. With a range selected, Return replaces it,
  // and guessing which end of it the writer meant is worse than not guessing.
  if (start !== end) return null;

  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const line = text.slice(lineStart, start);

  const bullet = BULLET.exec(line);
  const numbered = bullet ? null : NUMBERED.exec(line);
  if (!bullet && !numbered) return null;

  const [, indent = '', marker = '', gap = ' ', content = ''] = (bullet ?? numbered)!;

  // An item with nothing in it ends the list: the line becomes empty and the
  // caret stays on it, ready for an ordinary paragraph.
  if (content.trim() === '') {
    const next = text.slice(0, lineStart) + text.slice(start);
    return { text: next, selection: { start: lineStart, end: lineStart } };
  }

  const opener = numbered
    ? `${indent}${Number(marker) + 1}.${gap}`
    : `${indent}${marker}${gap}`;
  const inserted = `\n${opener}`;
  const next = text.slice(0, start) + inserted + text.slice(start);
  const at = start + inserted.length;
  return { text: next, selection: { start: at, end: at } };
}

/* -------------------------------------------------------------------------- *
 * What is already applied
 * -------------------------------------------------------------------------- */

/**
 * Whether an inline marker is already around the caret or the selection.
 *
 * Both arrangements count, for the same reason `toggleWrap` accepts both: the
 * writer may have selected `**bold**` or selected `bold` inside it, and with
 * nothing selected at all the caret may simply be sitting between the markers.
 */
export function hasWrap(
  text: string,
  selection: EditorSelection,
  marker: string
): boolean {
  const { start, end } = normalise(text, selection);
  const selected = text.slice(start, end);
  const len = marker.length;

  if (
    selected.length >= len * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    return true;
  }

  return (
    text.slice(Math.max(0, start - len), start) === marker &&
    text.slice(end, end + len) === marker
  );
}

/** Whether every line the selection touches already starts with `prefix`. */
export function hasLinePrefix(
  text: string,
  selection: EditorSelection,
  prefix: string
): boolean {
  const range = lineRange(text, selection);
  return text
    .slice(range.start, range.end)
    .split('\n')
    .every((line) => line.startsWith(prefix));
}

/** Whether every line the selection touches is already numbered. */
export function hasOrderedList(text: string, selection: EditorSelection): boolean {
  const range = lineRange(text, selection);
  return text
    .slice(range.start, range.end)
    .split('\n')
    .every((line) => ORDERED.test(line));
}

/** Whether the selection is inside a fence. */
export function hasFence(text: string, selection: EditorSelection): boolean {
  return enclosingFence(text, selection) !== null;
}
