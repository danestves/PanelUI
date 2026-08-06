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

  return replaceBlock(text, range, next.join('\n'));
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

  return replaceBlock(text, range, next.join('\n'));
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
export function toggleFence(text: string, selection: EditorSelection): EditResult {
  const range = lineRange(text, selection);
  const block = text.slice(range.start, range.end);
  const lines = block.split('\n');

  if (lines.length >= 2 && lines[0]?.startsWith('```') && lines.at(-1) === '```') {
    return replaceBlock(text, range, lines.slice(1, -1).join('\n'));
  }

  const leadIn = range.start > 0 && text[range.start - 1] !== '\n' ? '\n' : '';
  const fenced = `${leadIn}\`\`\`\n${block}\n\`\`\``;
  const result = replaceBlock(text, range, fenced);

  // Inside the fence, on the line the code goes on — not around the whole
  // block, which would be selecting the markers along with the content.
  const inner = range.start + leadIn.length + 4;
  return { text: result.text, selection: { start: inner, end: inner + block.length } };
}
