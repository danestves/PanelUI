/**
 * The script alphabet TextGlass writes its built-in words with, and the rule
 * for joining letters into one continuous stroke.
 *
 * ## Why an alphabet rather than five finished wordmarks
 *
 * A word stored as one long path is a word that can only be corrected as a
 * whole: nudging the `a` in "Khalid" means re-authoring every curve after it,
 * because each one is positioned relative to the last. Storing letters instead
 * means a letter is fixed once and every word containing it improves — and it
 * is the only way five words end up looking like one hand rather than five.
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
 * The space between letters is built into each letter's own exit rather than
 * inserted between them. A straight segment bolted on after the exit meets it
 * at a different angle, and every join in the word becomes a visible corner.
 *
 * Ink that lifts off the page is stored apart from that run. `i` has its dot
 * and `t` its crossbar as `marks`; a capital is `detached` entirely. They
 * become their own strokes, drawn after the run they belong to — which is also
 * the order a hand writes them in.
 *
 * ## The frame
 *
 * `y = 0` is the join line. The baseline is `+30`, so letter bodies sit below
 * the joins and the connecting strokes rise between them — a flat join at the
 * very bottom of the letters would read as an underline. x-height is `-70`,
 * ascenders reach `-205` and capitals `-215`. Everything leans forward by 11
 * degrees, applied to every letter from the same origin, which is most of why
 * they look written rather than assembled.
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
  a: { advance: 112, run: 'c 5.1 -7.3 21 -32.7 30.6 -44 c 9.5 -11.3 25.8 -21.3 26.7 -24 c 0.9 -2.7 -14.6 1.3 -21.6 8 c -7 6.7 -16.7 21 -20.2 32 c -3.5 11 -3.9 25.3 -0.6 34 c 3.3 8.7 13.2 16.3 20.5 18 c 7.3 1.7 16.9 -1 23.6 -8 c 6.7 -7 11.6 -20.3 16.6 -34 c 5 -13.7 11.9 -46 13.3 -48 c 1.4 -2 -3.3 24 -5 36 c -1.7 12 -9.7 31 -5 36 c 4.7 5 27.6 -5 33.2 -6' },
  c: { advance: 104, run: 'c 5.6 -8 23.4 -36.3 33.3 -48 c 9.9 -11.7 25.5 -19.7 26.3 -22 c 0.8 -2.3 -14.6 1.3 -21.6 8 c -7 6.7 -16.7 21 -20.2 32 c -3.5 11 -3.5 25 -0.6 34 c 2.9 9 11 17.3 18.1 20 c 7.1 2.7 13.3 0 24.8 -4 c 11.4 -4 36.6 -16.7 43.9 -20' },
  d: { advance: 116, run: 'c 5.1 -7.3 21 -32.7 30.6 -44 c 9.5 -11.3 25.8 -21.3 26.7 -24 c 0.9 -2.7 -14.6 1.3 -21.6 8 c -7 6.7 -16.7 21 -20.2 32 c -3.5 11 -3.9 25.3 -0.6 34 c 3.3 8.7 13.2 16.3 20.5 18 c 7.3 1.7 16.5 1 23.6 -8 c 7.1 -9 11.5 -21.7 18.9 -46 c 7.4 -24.3 19.3 -71.7 25.4 -100 c 6.2 -28.3 11.1 -57.3 11.6 -70 c 0.5 -12.7 -5.6 -17.7 -8.8 -6 c -3.3 11.7 -7.4 50 -10.8 76 c -3.4 26 -6.9 57.7 -9.6 80 c -2.7 22.3 -11.5 45.7 -6.5 54 c 5 8.3 30.6 -3.3 36.8 -4' },
  e: { advance: 108, run: 'c 4 -3.3 15.6 -15.3 23.9 -20 c 8.2 -4.7 19.2 -3 25.6 -8 c 6.3 -5 11.4 -15.7 12.3 -22 c 0.9 -6.3 -2.3 -13.7 -6.9 -16 c -4.5 -2.3 -14.2 -2.3 -20.4 2 c -6.2 4.3 -13.2 14.7 -16.7 24 c -3.5 9.3 -5.6 22 -4.2 32 c 1.4 10 6.2 23 12.6 28 c 6.4 5 17.2 4 25.6 2 c 8.4 -2 15.3 -10.3 24.7 -14 c 9.4 -3.7 26.3 -6.7 31.6 -8' },
  h: { advance: 132, run: 'c 5.3 -13.3 20.3 -51.2 31.6 -80 c 11.3 -28.8 27.4 -72.2 36.1 -93 c 8.7 -20.8 14.9 -25.2 16.2 -32 c 1.3 -6.8 -4.2 -11 -8.3 -9 c -4.1 2 -11.3 8.5 -16.1 21 c -4.8 12.5 -9.2 33.5 -12.5 54 c -3.3 20.5 -4.9 47.5 -7.4 69 c -2.5 21.5 -5.6 44.3 -7.7 60 c -2 15.7 -6.7 36 -4.6 34 c 2.1 -2 10.2 -31.7 16.9 -46 c 6.8 -14.3 16.3 -32.7 23.8 -40 c 7.4 -7.3 15.6 -6.7 20.8 -4 c 5.1 2.7 8.9 10.7 10.1 20 c 1.2 9.3 -1.8 24.7 -3 36 c -1.2 11.3 -10.2 30.3 -4.2 32 c 6 1.7 33.6 -18.3 40.3 -22' },
  i: { advance: 84, run: 'c 3.3 -5 12.8 -19.3 19.8 -30 c 7.1 -10.7 17.6 -27.3 22.6 -34 c 5 -6.7 7.8 -11.7 7.2 -6 c -0.6 5.7 -7.6 27.3 -10.8 40 c -3.1 12.7 -6.4 27 -8 36 c -1.6 9 -3.8 16.3 -1.5 18 c 2.3 1.7 6.4 -4 15.6 -8 c 9.1 -4 32.6 -13.3 39.1 -16', marks: [{ x: 65.5, y: -122, d: 'c 1.9 -1 8.9 -6.3 11.2 -6 c 2.3 0.3 2 6.7 2.4 8' }] },
  k: { advance: 130, run: 'c 5.3 -13.3 20.3 -51.2 31.6 -80 c 11.3 -28.8 27.4 -72.2 36.1 -93 c 8.7 -20.8 14.9 -25.2 16.2 -32 c 1.3 -6.8 -4.2 -11 -8.3 -9 c -4.1 2 -11.3 8.5 -16.1 21 c -4.8 12.5 -9.2 33.5 -12.5 54 c -3.3 20.5 -4.9 47.5 -7.4 69 c -2.5 21.5 -5.6 44.3 -7.7 60 c -2 15.7 -7.5 35 -4.6 34 c 2.9 -1 13.8 -28.3 21.8 -40 c 7.9 -11.7 17.9 -21.7 25.8 -30 c 8 -8.3 22.7 -21 21.9 -20 c -0.9 1 -19.6 18.3 -27.1 26 c -7.5 7.7 -18.2 14.7 -17.9 20 c 0.3 5.3 14.1 6.3 19.7 12 c 5.6 5.7 10.8 16.3 13.7 22 c 2.9 5.7 -3.8 14.3 3.7 12 c 7.5 -2.3 34.2 -21.7 41.1 -26' },
  l: { advance: 98, run: 'c 5.3 -13.3 20.3 -51.2 31.6 -80 c 11.3 -28.8 27.4 -72.2 36.1 -93 c 8.7 -20.8 14.9 -25.2 16.2 -32 c 1.3 -6.8 -4.2 -11 -8.3 -9 c -4.1 2 -11.3 8.5 -16.1 21 c -4.8 12.5 -9.2 33.5 -12.5 54 c -3.3 20.5 -4.9 47.5 -7.4 69 c -2.5 21.5 -6.3 44.3 -7.7 60 c -1.4 15.7 -4.1 29.7 -0.6 34 c 3.5 4.3 10.4 -4 21.6 -8 c 11.1 -4 37.6 -13.3 45.1 -16' },
  m: { advance: 190, run: 'c 3 -7 11.6 -30.7 18.2 -42 c 6.5 -11.3 14.6 -22 21.1 -26 c 6.4 -4 14.4 -3.7 17.6 2 c 3.2 5.7 3.4 17 1.8 32 c -1.6 15 -12.7 56.7 -11.3 58 c 1.4 1.3 12.5 -35 19.7 -50 c 7.2 -15 16.9 -33.7 23.8 -40 c 6.9 -6.3 14.4 -3.7 17.6 2 c 3.2 5.7 3.3 17.3 1.8 32 c -1.5 14.7 -12.4 55 -10.9 56 c 1.5 1 12.5 -35 19.7 -50 c 7.2 -15 16.9 -33.7 23.8 -40 c 6.9 -6.3 14.4 -3.7 17.6 2 c 3.2 5.7 3.2 17.7 1.8 32 c -1.5 14.3 -15.1 48.7 -10.5 54 c 4.6 5.3 31.9 -18.3 38.3 -22' },
  n: { advance: 136, run: 'c 3 -7 11.6 -30.7 18.2 -42 c 6.5 -11.3 14.6 -22 21.1 -26 c 6.4 -4 14.4 -3.7 17.6 2 c 3.2 5.7 3.4 17 1.8 32 c -1.6 15 -12.7 56.7 -11.3 58 c 1.4 1.3 12.5 -35 19.7 -50 c 7.2 -15 16.9 -33.7 23.8 -40 c 6.9 -6.3 14.4 -3.7 17.6 2 c 3.2 5.7 3.2 17.7 1.8 32 c -1.5 14.3 -14.8 48.7 -10.5 54 c 4.3 5.3 30.2 -18.3 36.3 -22' },
  o: { advance: 120, run: 'c 5.6 -8 23.4 -36.3 33.3 -48 c 9.9 -11.7 18.7 -20.7 26.3 -22 c 7.6 -1.3 16 6.7 19.3 14 c 3.2 7.3 2.6 19.3 0.2 30 c -2.4 10.7 -7.9 25.3 -14.6 34 c -6.7 8.7 -17.9 16.7 -25.5 18 c -7.6 1.3 -16.4 -3.3 -20.1 -10 c -3.7 -6.7 -4.5 -19.7 -2.2 -30 c 2.3 -10.3 9.1 -23 16.2 -32 c 7.1 -9 18.1 -19.3 26.3 -22 c 8.2 -2.7 17.1 1.3 22.8 6 c 5.8 4.7 5.4 11.7 11.7 22 c 6.3 10.3 21.9 33.3 26.2 40', final: 'c 5.6 -8 23.4 -36.3 33.3 -48 c 9.9 -11.7 18.7 -20.7 26.3 -22 c 7.6 -1.3 16 6.7 19.3 14 c 3.2 7.3 2.6 19.3 0.2 30 c -2.4 10.7 -7.9 25.3 -14.6 34 c -6.7 8.7 -17.9 16.7 -25.5 18 c -7.6 1.3 -16.4 -3.3 -20.1 -10 c -3.7 -6.7 -4.5 -19.7 -2.2 -30 c 2.3 -10.3 9.1 -23 16.2 -32 c 7.1 -9 18 -19 26.3 -22 c 8.2 -3 16.7 1.7 23.2 4 c 6.5 2.3 11.6 7 16.1 10 c 4.4 3 8.7 6.7 10.4 8' },
  s: { advance: 98, run: 'c 4.8 -6 19.9 -25 29 -36 c 9.1 -11 21.7 -24.3 25.8 -30 c 4.1 -5.7 1.8 -6 -1.2 -4 c -3.1 2 -13.5 9.7 -17.1 16 c -3.6 6.3 -6.1 16 -4.3 22 c 1.8 6 11.4 8.3 15.3 14 c 3.9 5.7 9.1 13.3 8.1 20 c -1 6.7 -8.2 16.7 -13.9 20 c -5.6 3.3 -15.7 1.7 -20 0 c -4.3 -1.7 -8.6 -8.7 -6.1 -10 c 2.6 -1.3 14.1 3 21.6 2 c 7.5 -1 13.4 -5.7 23.6 -8 c 10.1 -2.3 31 -5 37.2 -6' },
  t: { advance: 98, run: 'c 4 -8.3 14.8 -30 23.7 -50 c 8.9 -20 22.2 -52.3 29.6 -70 c 7.4 -17.7 13 -34.3 15 -36 c 2 -1.7 0.7 10 -3.1 26 c -3.8 16 -13.7 48.3 -19.6 70 c -5.9 21.7 -12.6 46 -15.7 60 c -3.1 14 -5.7 21 -2.7 24 c 3.1 3 9.4 -2 21.2 -6 c 11.8 -4 41.2 -15 49.5 -18', marks: [{ x: 28.1, y: -94, d: 'c 5.3 -1.7 20.5 -7.7 31.9 -10 c 11.5 -2.3 30.6 -3.3 36.8 -4' }] },
  w: { advance: 170, run: 'c 3.3 -6.7 13.2 -28.7 19.8 -40 c 6.5 -11.3 15.3 -23.7 19.4 -28 c 4.2 -4.3 4.5 -6 5.6 2 c 1.1 8 1 31 1.1 46 c 0.1 15 -3.2 44 -0.6 44 c 2.7 0 10.3 -29 16.6 -44 c 6.2 -15 16.4 -38 20.9 -46 c 4.6 -8 5.5 -9.7 6.4 -2 c 0.8 7.7 -1 32.7 -1.3 48 c -0.3 15.3 -3.2 44 -0.6 44 c 2.7 0 10.3 -29 16.6 -44 c 6.2 -15 16.4 -38 20.9 -46 c 4.6 -8 3.9 -6.3 6.4 -2 c 2.5 4.3 2.1 16.7 8.6 28 c 6.5 11.3 25.2 33.3 30.2 40' },
  K: { advance: 132, detached: [{ x: 73.6, y: -215, d: 'c -3.1 10.8 -12.1 41.5 -18.6 65 c -6.6 23.5 -14.2 52.7 -20.8 76 c -6.5 23.3 -13.5 47.3 -18.4 64 c -4.9 16.7 -9.2 30 -11 36' }, { x: 158.7, y: -210, d: 'c -5.6 6.3 -21.9 25 -33.4 38 c -11.5 13 -25 27.7 -35.8 40 c -10.7 12.3 -27.4 24.3 -28.6 34 c -1.2 9.7 14.9 14.3 21.3 24 c 6.5 9.7 12 22.3 17.4 34 c 5.4 11.7 11.4 25.3 15 36 c 3.6 10.7 5.5 23.3 6.6 28' }] },
};

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

    if (run === null) run = `M ${x} 0`;
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
