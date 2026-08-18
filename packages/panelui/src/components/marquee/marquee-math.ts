/**
 * The arithmetic behind the loop, kept out of the component so it can be tested
 * without rendering one.
 *
 * Every value here reaches a Reanimated timing or a layout offset, and both
 * treat `NaN` and `Infinity` as a frame that never resolves rather than as an
 * error. A marquee handed a bad number should hold still, not wedge — so the
 * guards live at the boundary, once, instead of at each use.
 */

/**
 * Points per second. Slow enough that a word stays readable as it crosses,
 * which is the speed a ticker is actually for.
 */
export const DEFAULT_MARQUEE_SPEED = 40;

/**
 * Includes the copy just before and just after the viewport. Keeping this
 * fixed prevents tiny content (for example a one-point separator) from
 * multiplying an arbitrary React subtree hundreds of times.
 */
export const MAX_MARQUEE_COPIES = 32;

export function normalizeMarqueeSpeed(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_MARQUEE_SPEED;
  return Math.max(value, 0);
}

export function normalizeMarqueeSpacing(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(value, 0);
}

export function marqueeCopyCount(
  viewport: number,
  content: number,
  spacing: number
): { period: number; count: number } {
  const safeViewport = Number.isFinite(viewport) ? Math.max(viewport, 0) : 0;
  const safeContent = Number.isFinite(content) ? Math.max(content, 0) : 0;
  const naturalPeriod =
    safeContent > 0 ? safeContent + normalizeMarqueeSpacing(spacing) : 0;
  if (naturalPeriod <= 0 || safeViewport <= 0) {
    return { period: naturalPeriod, count: 0 };
  }

  // Two copies sit outside the viewport to cover one complete loop. If the
  // requested content-and-gap period would need more than the remaining copy
  // budget, widen the layout period (effectively adding whitespace) instead
  // of mounting an unbounded number of identical subtrees.
  const minimumPeriod = safeViewport / (MAX_MARQUEE_COPIES - 2);
  const period = Math.max(naturalPeriod, minimumPeriod);
  return {
    period,
    count: Math.min(
      MAX_MARQUEE_COPIES,
      Math.ceil(safeViewport / period) + 2
    ),
  };
}
