/**
 * Where each character sits on the ring, kept out of the component so it can
 * be tested without rendering one.
 *
 * Every number here reaches a transform, and a transform treats `NaN` and
 * `Infinity` as a frame that never resolves rather than as an error — a ring
 * handed a bad radius should draw nothing, not wedge. So the guards live at
 * the boundary, once, instead of at each use.
 */

/** Points from the centre to the baseline the characters sit on. */
export const DEFAULT_CIRCULAR_TEXT_RADIUS = 90;

/** Milliseconds for one full turn. Slow: it is decoration, not a spinner. */
export const DEFAULT_CIRCULAR_TEXT_DURATION = 20000;

/** Degrees of the circle the text is spread across. The whole way round. */
export const DEFAULT_CIRCULAR_TEXT_SPREAD = 360;

export function normalizeRadius(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CIRCULAR_TEXT_RADIUS;
  return Math.max(value, 0);
}

export function normalizeDuration(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CIRCULAR_TEXT_DURATION;
  return Math.max(value, 0);
}

export function normalizeSpread(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CIRCULAR_TEXT_SPREAD;
  // Clamped rather than wrapped: past a full turn the characters would overlap
  // the ones already there, and a spread of -40 is a spread of 40 the other
  // way round, which `reverse` is the prop for.
  return Math.min(Math.abs(value), 360);
}

export interface CircularTextGlyph {
  /** The character itself. */
  character: string;
  /** Its place in the string, which is what makes a stable key. */
  index: number;
  /** Degrees clockwise from the top, before any rotation of the ring. */
  angle: number;
}

/**
 * One entry per character, evenly spaced around the arc.
 *
 * The step is measured between characters rather than across them, and which
 * of the two you divide by is the whole difference between a closed ring and
 * one with a visible seam. A full turn has no last gap — the end of the string
 * is adjacent to its start — so `n` characters make `n` gaps and the step is
 * `spread / n`. Anything less than a full turn has one gap fewer than it has
 * characters, so the step is `spread / (n - 1)` and the text reaches both ends
 * of the arc it was given instead of stopping short of the second one.
 */
export function circularTextGlyphs(
  text: string,
  spread: number,
  startAngle: number
): CircularTextGlyph[] {
  const characters = Array.from(text);
  if (characters.length === 0) return [];

  const arc = normalizeSpread(spread);
  const from = Number.isFinite(startAngle) ? startAngle : 0;
  const closed = arc >= 360;

  // One character cannot be spread across anything, and dividing by the zero
  // gaps it has would put it nowhere.
  const step =
    characters.length === 1 ? 0 : arc / (closed ? characters.length : characters.length - 1);

  return characters.map((character, index) => ({
    character,
    index,
    angle: from + step * index,
  }));
}
