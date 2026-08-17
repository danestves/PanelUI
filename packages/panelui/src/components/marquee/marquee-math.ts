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
  const period = safeContent > 0 ? safeContent + normalizeMarqueeSpacing(spacing) : 0;
  if (period <= 0 || safeViewport <= 0) return { period, count: 0 };
  return { period, count: Math.ceil(safeViewport / period) + 2 };
}
