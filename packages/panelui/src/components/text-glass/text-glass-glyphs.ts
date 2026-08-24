/**
 * The script alphabet TextGlass writes its built-in words with, and the rule
 * for joining letters into one continuous stroke.
 *
 * ## Why an alphabet rather than five finished wordmarks
 *
 * A word stored as one long path is a word that can only be corrected as a
 * whole: nudging the `a` in "Khalid" means re-authoring every curve after it,
 * because each one is positioned relative to the last. Storing letters instead
 * means a letter is fixed once and every word containing it improves.
 *
 * ## The join, which is what makes it read as handwriting
 *
 * Every letter is a run of **relative** cubics that starts and ends on the
 * join line, so its net displacement is exactly its own `advance` across and
 * nothing vertically. Concatenating two letters is therefore string
 * concatenation — one absolute `M` opens the word and every letter after it
 * continues the same stroke. A word is one unbroken line, the way a hand
 * writes it, rather than letters that happen to be adjacent.
 *
 * Ink that lifts off the page is stored apart from that run. `i` has its dot
 * and `t` its crossbar as `marks`; a capital is `detached` entirely. They
 * become their own strokes, drawn after the run they belong to — which is also
 * the order a hand writes them in.
 *
 * ## The frame
 *
 * `y = 0` is the join line. The baseline is `+15`, so letter bodies sit below
 * the joins and the connecting strokes rise between them — a flat join at the
 * very bottom of the letters would read as an underline. x-height is `-45`,
 * ascenders reach `-113` and capitals `-118`.
 *
 * A word-final letter may declare `final`, used in place of `run` when nothing
 * follows it. `o` needs it: its ordinary exit descends to the join line, and
 * with no letter after it to receive that stroke the shape closes into an `a`.
 */

/** One letter: how far it carries the pen, and the ink it lays down. */
export interface TextGlassGlyph {
  /** How far the pen advances, in frame units. Equals the run's own width. */
  advance: number;
  /** Relative cubics from the join line back to it, `advance` to the right. */
  run?: string;
  /** Used instead of `run` when the letter ends the word. */
  final?: string;
  /** Ink drawn after the run — a dot, a crossbar — at its own offset. */
  marks?: { x: number; y: number; d: string }[];
  /** A letter written without joining, as its own strokes. */
  detached?: { x: number; y: number; d: string }[];
}

/**
 * The letters the built-in words need. Adding a word means adding whatever it
 * is missing here; there is nothing else to update.
 */
export const TEXT_GLASS_GLYPHS: Record<string, TextGlassGlyph> = {
  a: { advance: 60, run: 'c 10 -12 22 -26 32 -36 c -4 -10 -17 -12 -26 -5 c -6 5 -8 20 -4 31 c 4 12 17 19 30 15 c 12 -5 16 -20 16 -46 c 1 20 2 40 4 56 c 2 6 4 5 8 -15' },
  c: { advance: 52, run: 'c 8 -17 19 -35 28 -41 c 5 -4 2 -12 -7 -11 c -14 2 -23 24 -19 43 c 4 16 16 26 32 22 c 7 0 12 -4 18 -13' },
  d: { advance: 58, run: 'c 8 -16 18 -34 27 -40 c 5 -4 2 -11 -7 -10 c -13 2 -22 23 -18 41 c 4 16 15 25 30 20 c 13 -6 18 -55 18 -124 c 0 -13 -3 -19 -5 -17 c -2 22 3 108 5 145 c 2 7 4 6 8 -15' },
  e: { advance: 58, run: 'c 6 -14 17 -30 26 -40 c 6 -7 3 -16 -6 -14 c -14 3 -22 22 -18 42 c 3 17 15 27 32 27 c 9 0 17 -5 24 -15' },
  h: { advance: 72, run: 'c 6 -30 18 -78 28 -106 c 4 -11 0 -18 -6 -14 c -6 4 -9 14 -8 26 c 2 24 5 76 8 109 c 3 -32 13 -58 27 -58 c 12 0 14 20 8 58 c 4 8 6 4 15 -15' },
  i: { advance: 44, run: 'c 6 -18 15 -36 22 -44 c 3 -4 5 -2 4 6 c -3 18 -5 36 -3 53 c 3 7 11 -1 21 -15', marks: [{x: 24,y: -68,d: 'c 3 -4 6 -1 3 3'}] },
  k: { advance: 70, run: 'c 6 -30 18 -76 28 -104 c 4 -11 0 -18 -6 -14 c -6 4 -9 14 -8 26 c 2 24 5 74 8 107 c 5 -24 17 -40 29 -48 c -12 8 -22 18 -27 27 c 8 5 17 12 25 21 c 5 4 11 2 21 -15' },
  l: { advance: 52, run: 'c 6 -30 18 -80 28 -108 c 4 -11 0 -18 -6 -14 c -6 4 -9 14 -8 26 c 2 24 6 78 10 111 c 3 8 14 6 28 -15' },
  m: { advance: 96, run: 'c 5 -28 12 -46 23 -46 c 10 0 13 20 8 61 c 2 -33 10 -61 21 -61 c 10 0 13 20 8 61 c 2 -33 10 -61 21 -61 c 10 0 13 20 8 61 c 2 5 0 2 7 -15' },
  n: { advance: 62, run: 'c 5 -28 12 -46 23 -46 c 10 0 13 20 8 61 c 2 -33 10 -61 21 -61 c 10 0 13 20 8 61 c 2 5 0 2 2 -15' },
  o: { advance: 68, run: 'c 7 -16 18 -34 27 -42 c 5 -5 2 -12 -7 -11 c -14 2 -23 24 -18 43 c 4 16 16 26 32 21 c 13 -4 19 -16 19 -32 c 0 -9 -2 -15 -5 -19 c 9 -2 14 3 16 12 c 2 6 3 12 4 28', final: 'c 7 -16 18 -34 27 -42 c 5 -5 2 -12 -7 -11 c -14 2 -23 24 -18 43 c 4 16 16 26 32 21 c 13 -4 19 -16 19 -32 c 0 -9 -2 -15 -5 -19 c 9 -1 14 2 16 8' },
  s: { advance: 50, run: 'c 8 -16 18 -32 25 -42 c 4 -6 0 -13 -8 -11 c -11 2 -16 12 -12 20 c 3 7 11 11 15 17 c 6 8 3 21 -8 24 c -6 2 3 7 13 6 c 9 -1 18 -5 25 -14' },
  t: { advance: 48, run: 'c 3 -26 8 -62 14 -86 c 2 -8 6 -12 8 -6 c 2 12 -5 74 -9 107 c 2 9 12 10 21 -3 c 5 -3 9 -7 14 -12', marks: [{x: 0,y: -54,d: 'c 15 -5 32 -7 44 -7'}] },
  w: { advance: 96, run: 'c 4 -26 10 -44 17 -46 c 6 16 11 40 15 61 c 3 -24 9 -46 16 -61 c 6 16 11 40 15 61 c 3 -24 9 -46 16 -61 c 3 14 9 32 17 46' },
  K: { advance: 78, detached: [{x: 10,y: -116,d: 'c -4 40 -8 88 -10 131'},{x: 62,y: -114,d: 'c -14 22 -30 42 -44 58 c 12 6 24 28 34 52 c 5 8 9 13 13 19'}] },
};

/**
 * Extra join between two letters. One knob for how tightly a word is set, and
 * a multiple of three so the cubic that carries it is written in whole numbers.
 */
const TRACKING = 9;

/** The words `word` selects, and the letters each is written with. */
export const TEXT_GLASS_WORDS = {
  hello: 'hello',
  khalid: 'Khalid',
  hi: 'hi',
  welcome: 'welcome',
  thanks: 'thanks',
} as const;

/** Which built-in word to write. */
export type TextGlassWord = keyof typeof TEXT_GLASS_WORDS;

/**
 * A word as the ordered strokes a hand would draw it in: the joined run first,
 * then the ink lifted off for it.
 */
export function writeWord(text: string): string[] {
  const strokes: string[] = [];
  const letters = [...text];
  let x = 0;
  let run: string | null = null;
  let pending: string[] = [];

  const lift = () => {
    if (run) strokes.push(run);
    run = null;
    strokes.push(...pending);
    pending = [];
  };

  for (let index = 0; index < letters.length; index += 1) {
    const glyph = TEXT_GLASS_GLYPHS[letters[index]!];
    if (!glyph) continue;

    if (glyph.detached) {
      lift();
      for (const stroke of glyph.detached) {
        strokes.push(`M ${x + stroke.x} ${stroke.y} ${stroke.d}`);
      }
      x += glyph.advance;
      continue;
    }

    if (run === null) {
      run = `M ${x} 0`;
    } else {
      run += ` c ${TRACKING / 3} 0 ${(TRACKING / 3) * 2} 0 ${TRACKING} 0`;
      x += TRACKING;
    }
    const finishes = index === letters.length - 1;
    run += ` ${finishes && glyph.final ? glyph.final : glyph.run}`;
    for (const mark of glyph.marks ?? []) {
      pending.push(`M ${x + mark.x} ${mark.y} ${mark.d}`);
    }
    x += glyph.advance;
  }

  lift();
  return strokes;
}
