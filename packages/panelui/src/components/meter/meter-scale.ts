/**
 * Where a reading sits on a meter's scale, and what colour it has earned.
 *
 * Kept apart from the component because it is the part that can be wrong
 * without looking wrong: a threshold picked in the wrong order, or a segment
 * count that rounds a real reading down to nothing, is a meter that lies
 * quietly. None of it touches React, so it can be tested on its own.
 */

/** The token a meter can be painted with. */
export type MeterColor =
  | 'primary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'muted';

/**
 * A point on the scale, and the colour the meter takes from there upwards.
 *
 * `from` is in the same units as `value` — not a percentage of the range — so
 * a threshold on a 0–8 GB meter is written in gigabytes.
 */
export interface MeterThreshold {
  /** The value at which this colour takes over. */
  from: number;
  /** What the bar is painted with at or above `from`. */
  color: MeterColor;
}

/** `value` held inside the scale, so a stray number cannot escape the track. */
export function clamp(value: number, min: number, max: number) {
  if (!(value > min)) return min;
  if (value > max) return max;
  return value;
}

/**
 * How far up the scale the value sits, 0–1. An empty or inverted range has no
 * meaningful position in it, so it reads as empty rather than dividing by zero.
 */
export function fractionOf(value: number, min: number, max: number) {
  const span = max - min;
  if (!(span > 0)) return 0;
  return clamp((value - min) / span, 0, 1);
}

/**
 * The colour the reading has earned: the highest threshold at or below the
 * value, or the base colour when it has reached none of them.
 *
 * Highest-wins rather than first-wins, so the caller can list thresholds in
 * any order and get the same answer. A rule that depended on the order would
 * make a reordered array a silent behaviour change.
 */
export function colorFor(
  value: number,
  base: MeterColor | undefined,
  thresholds: MeterThreshold[] | undefined
) {
  if (!thresholds?.length) return base;
  let winner: MeterThreshold | undefined;
  for (const threshold of thresholds) {
    if (value < threshold.from) continue;
    if (!winner || threshold.from > winner.from) winner = threshold;
  }
  return winner?.color ?? base;
}

/**
 * How many blocks of a segmented meter are lit.
 *
 * Rounded up, so any reading above the floor lights at least one. Rounding
 * down would leave the whole first block of a four-block meter dark, and "a
 * little" looking like "none" is the reading a meter can least afford to get
 * wrong.
 */
export function litSegments(fraction: number, segments: number) {
  if (!(segments > 0)) return 0;
  return Math.min(Math.ceil(fraction * segments), segments);
}

/**
 * The value caption: an explicit override, an `Intl` rendering, or a rounded
 * percent.
 *
 * A `percent` style is given the fraction, because that is what a percentage
 * of the scale means; every other style is given the value, because a byte
 * count or a score is a quantity and not a proportion.
 */
export function formatValue(
  value: number,
  fraction: number,
  valueLabel?: string,
  formatOptions?: Intl.NumberFormatOptions
) {
  if (valueLabel != null) return valueLabel;
  if (formatOptions) {
    try {
      return new Intl.NumberFormat(undefined, formatOptions).format(
        formatOptions.style === 'percent' ? fraction : value
      );
    } catch {
      // Some engines ship a partial Intl; fall through to the plain percent.
    }
  }
  return `${Math.round(fraction * 100)}%`;
}
