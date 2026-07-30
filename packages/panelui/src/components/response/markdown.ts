/**
 * A small Markdown reader, written for text that is still arriving.
 *
 * No parser library. What a chat answer actually contains is headings,
 * paragraphs, lists, fenced code, blockquotes, tables, rules and a handful of
 * inline marks — and every general-purpose parser worth using assumes it has
 * been handed the whole document. That assumption is the one thing that is
 * never true here.
 *
 * ## Half-arrived markdown
 *
 * A token stream shows you every prefix of the final text, so the reader sees
 * `**bo`, then `**bol`, then `**bold**`. Treated naively that is three
 * documents: two with literal asterisks in them and one with a bolded word. The
 * text would flash between styles on nearly every frame, which is worse than no
 * formatting at all — the eye tracks the flicker instead of the words.
 *
 * So an unterminated construct at the very end of the input is *completed
 * speculatively* rather than escaped: an open fence becomes a code block that
 * is still filling, an open `**` becomes bold text that is still being written.
 * Anything unterminated anywhere else is literal, because a document that has
 * stopped arriving means what it says.
 *
 * The two rules that follow from this:
 *
 * - **Only the tail is speculative.** An asterisk in the middle of a finished
 *   paragraph is an asterisk.
 * - **A speculative construct never removes visible text.** The characters that
 *   opened it are hidden, and everything after them stays on screen. Otherwise
 *   the last word of the answer disappears and reappears as its delimiter
 *   arrives.
 */

export type Align = 'left' | 'center' | 'right';

export interface InlineToken {
  kind: 'text' | 'code' | 'link' | 'image';
  value: string;
  /** For links and images. */
  href?: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; inline: InlineToken[] }
  | { type: 'paragraph'; inline: InlineToken[] }
  | { type: 'code'; code: string; language?: string; open: boolean }
  | { type: 'quote'; blocks: Block[] }
  | { type: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { type: 'table'; head: InlineToken[][]; rows: InlineToken[][][]; align: (Align | null)[] }
  | { type: 'rule' };

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*)$/;
const RULE = /^ {0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const BULLET = /^(\s*)([-*+])\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

/**
 * Splits a document into blocks.
 *
 * `streaming` is what turns speculative completion on. With it off — a stored
 * answer, a message that has finished — an unterminated fence is just a
 * paragraph starting with three backticks, which is what it literally is.
 */
export function parseMarkdown(source: string, streaming = false): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  return parseBlocks(lines, streaming);
}

function parseBlocks(lines: string[], streaming: boolean): Block[] {
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1]!;
      const language = fence[2] || undefined;
      const body: string[] = [];
      let closed = false;
      index += 1;

      while (index < lines.length) {
        const current = lines[index]!;
        // Closed by a run of the same character at least as long as the opener,
        // and nothing else on the line.
        if (current.trimStart().startsWith(marker[0]!.repeat(marker.length)) && !current.trim().slice(marker.length).trim()) {
          closed = true;
          index += 1;
          break;
        }
        body.push(current);
        index += 1;
      }

      // An unclosed fence in a finished document is not a code block: it is a
      // paragraph that begins with three backticks, and pretending otherwise
      // swallows the rest of the answer.
      if (!closed && !streaming) {
        blocks.push({ type: 'paragraph', inline: parseInline(line, false) });
        for (const text of body) {
          if (text.trim()) blocks.push({ type: 'paragraph', inline: parseInline(text, false) });
        }
        continue;
      }

      blocks.push({ type: 'code', code: body.join('\n'), language, open: !closed });
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      index += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1]!.length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({
        type: 'heading',
        level,
        // Trailing hashes are a closing marker, not content.
        inline: parseInline(heading[2]!.replace(/\s+#+\s*$/, ''), streaming && index === lines.length - 1),
      });
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (index < lines.length) {
        const match = QUOTE.exec(lines[index]!);
        if (!match) break;
        body.push(match[1]!);
        index += 1;
      }
      blocks.push({ type: 'quote', blocks: parseBlocks(body, streaming) });
      continue;
    }

    const table = parseTable(lines, index, streaming);
    if (table) {
      blocks.push(table.block);
      index = table.next;
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const list = parseList(lines, index, streaming);
      blocks.push(list.block);
      index = list.next;
      continue;
    }

    // A paragraph runs to the first blank line or the first line that starts
    // something else.
    const body: string[] = [];
    while (index < lines.length) {
      const current = lines[index]!;
      if (!current.trim()) break;
      if (
        index > 0 &&
        (FENCE.test(current) ||
          HEADING.test(current) ||
          RULE.test(current) ||
          QUOTE.test(current) ||
          BULLET.test(current) ||
          ORDERED.test(current)) &&
        body.length
      ) {
        break;
      }
      body.push(current.trim());
      index += 1;
    }

    blocks.push({
      type: 'paragraph',
      inline: parseInline(body.join(' '), streaming && index >= lines.length),
    });
  }

  return blocks;
}

/**
 * A GFM table, or nothing.
 *
 * The divider row is what makes a table a table — a run of pipes on its own is
 * just a paragraph with pipes in it — so a header line is only a header once
 * the line under it has arrived. Mid-stream that means a table appears a beat
 * after its first row, which is the right beat: it is not a table yet.
 */
function parseTable(
  lines: string[],
  start: number,
  streaming: boolean
): { block: Block; next: number } | null {
  const header = lines[start];
  const divider = lines[start + 1];
  if (!header || !divider) return null;
  if (!header.includes('|')) return null;
  if (!TABLE_DIVIDER.test(divider)) return null;

  const head = splitRow(header).map((cell) => parseInline(cell, false));
  const align = splitRow(divider).map((cell): Align | null => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return null;
  });

  const rows: InlineToken[][][] = [];
  let index = start + 2;
  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.trim() || !line.includes('|')) break;
    // The last line of a stream is very likely half-typed. Holding it back for
    // one token is better than a row that grows a cell at a time.
    const partial = streaming && index === lines.length - 1;
    if (partial) {
      index += 1;
      break;
    }
    rows.push(splitRow(line).map((cell) => parseInline(cell, false)));
    index += 1;
  }

  return { block: { type: 'table', head, rows, align }, next: index };
}

function splitRow(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/**
 * A list, and everything indented under it.
 *
 * Nesting is by indent, and a nested list becomes a block inside its parent
 * item rather than a sibling — which is what lets an item hold a paragraph, a
 * sub-list and a code block at once.
 */
function parseList(
  lines: string[],
  start: number,
  streaming: boolean
): { block: Block; next: number } {
  const first = BULLET.exec(lines[start]!) ?? ORDERED.exec(lines[start]!)!;
  const ordered = !BULLET.test(lines[start]!);
  const baseIndent = first[1]!.length;
  const startNumber = ordered ? Number(first[2]) : 1;

  const items: string[][] = [];
  let current: string[] | null = null;
  let index = start;

  while (index < lines.length) {
    const line = lines[index]!;

    if (!line.trim()) {
      // A blank line inside a list is only the end of it if what follows is not
      // indented under an item.
      const next = lines[index + 1];
      if (next && next.trim() && leadingSpaces(next) <= baseIndent && !isItem(next)) break;
      if (current) current.push('');
      index += 1;
      continue;
    }

    const item = BULLET.exec(line) ?? ORDERED.exec(line);
    if (item && item[1]!.length <= baseIndent) {
      if (ordered !== !BULLET.test(line)) break;
      current = [item[3]!];
      items.push(current);
      index += 1;
      continue;
    }

    if (leadingSpaces(line) > baseIndent && current) {
      current.push(line.slice(baseIndent + 1));
      index += 1;
      continue;
    }

    break;
  }

  return {
    block: {
      type: 'list',
      ordered,
      start: Number.isFinite(startNumber) ? startNumber : 1,
      items: items.map((body, position) =>
        parseBlocks(body, streaming && position === items.length - 1)
      ),
    },
    next: index,
  };
}

function isItem(line: string): boolean {
  return BULLET.test(line) || ORDERED.test(line);
}

function leadingSpaces(line: string): number {
  return line.length - line.trimStart().length;
}

/* -------------------------------------------------------------------------- */
/* Inline                                                                     */
/* -------------------------------------------------------------------------- */

interface Marks {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}

/**
 * Splits a run of text into styled spans.
 *
 * `tail` says this run is the end of a stream, which is what licenses closing
 * an open delimiter speculatively. It is deliberately narrow: only the *last*
 * unterminated opener on the line is completed, and only when nothing after it
 * could still turn out to be the closer.
 */
export function parseInline(source: string, tail: boolean): InlineToken[] {
  const tokens: InlineToken[] = [];
  let buffer = '';
  let index = 0;
  const marks: Marks = {};

  const flush = () => {
    if (!buffer) return;
    tokens.push({ kind: 'text', value: buffer, ...marks });
    buffer = '';
  };

  while (index < source.length) {
    const rest = source.slice(index);

    // Escapes come first, or `\*` would open emphasis.
    if (rest[0] === '\\' && rest.length > 1) {
      buffer += rest[1];
      index += 2;
      continue;
    }

    // Inline code wins over emphasis: asterisks inside backticks are literal.
    if (rest[0] === '`') {
      const run = /^(`+)/.exec(rest)![1]!;
      const closer = source.indexOf(run, index + run.length);
      if (closer !== -1) {
        flush();
        tokens.push({ kind: 'code', value: source.slice(index + run.length, closer), ...marks });
        index = closer + run.length;
        continue;
      }
      if (tail) {
        // Still being typed. Everything after the backtick is code so far.
        flush();
        const value = source.slice(index + run.length);
        if (value) tokens.push({ kind: 'code', value, ...marks });
        index = source.length;
        continue;
      }
      buffer += run;
      index += run.length;
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^)\s]*)[^)]*\)/.exec(rest);
    if (image) {
      flush();
      tokens.push({ kind: 'image', value: image[1]!, href: image[2]! });
      index += image[0].length;
      continue;
    }

    const link = /^\[([^\]]*)\]\(([^)\s]*)[^)]*\)/.exec(rest);
    if (link) {
      flush();
      tokens.push({ kind: 'link', value: link[1]!, href: link[2]!, ...marks });
      index += link[0].length;
      continue;
    }

    // A link whose closing paren has not arrived. Show the label and nothing
    // else — the brackets and the half-typed URL are scaffolding, and dropping
    // them now means the text does not jump when the rest lands.
    if (tail) {
      const partialLink = /^\[([^\]]*)\](\([^)]*)?$/.exec(rest);
      if (partialLink) {
        flush();
        if (partialLink[1]) tokens.push({ kind: 'text', value: partialLink[1], ...marks });
        index = source.length;
        continue;
      }
    }

    const emphasis = /^(\*\*\*|___|\*\*|__|~~|\*|_)/.exec(rest);
    if (emphasis) {
      const marker = emphasis[1]!;
      const applied = markFor(marker);
      const open = Object.keys(applied).every((key) => marks[key as keyof Marks]);

      // Closing whichever of these is currently open.
      if (open) {
        flush();
        for (const key of Object.keys(applied)) delete marks[key as keyof Marks];
        index += marker.length;
        continue;
      }

      // An opener has to lean on the word it opens. `2 * 3` is multiplication,
      // and `a * b` is not the start of anything — without this the asterisk
      // disappears and the reader is left with two spaces where an operator was.
      const after = source[index + marker.length];
      if (after === undefined || /\s/.test(after)) {
        buffer += marker;
        index += marker.length;
        continue;
      }

      const closer = source.indexOf(marker, index + marker.length);
      if (closer !== -1) {
        flush();
        Object.assign(marks, applied);
        index += marker.length;
        continue;
      }

      if (tail && index + marker.length < source.length) {
        // Unterminated at the end of a stream: assume it will close, so the
        // words that have arrived are styled now rather than restyled later.
        flush();
        Object.assign(marks, applied);
        index += marker.length;
        continue;
      }

      // Unterminated in finished text, or nothing after it yet. Literal.
      buffer += marker;
      index += marker.length;
      continue;
    }

    buffer += rest[0];
    index += 1;
  }

  flush();
  return tokens;
}

function markFor(marker: string): Marks {
  switch (marker) {
    case '***':
    case '___':
      return { bold: true, italic: true };
    case '**':
    case '__':
      return { bold: true };
    case '~~':
      return { strike: true };
    default:
      return { italic: true };
  }
}
