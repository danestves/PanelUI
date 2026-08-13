/** JavaScript numbers carry about fifteen reliable decimal digits. */
const MAX_DECIMAL_PRECISION = 15;

/** Decimals implied by `step`, including numbers written with an exponent. */
export function precisionOf(step: number): number {
  if (!Number.isFinite(step)) return 0;

  const [coefficient = '', exponentText] = Math.abs(step).toString().toLowerCase().split('e');
  const decimals = coefficient.split('.')[1]?.length ?? 0;
  const exponent = exponentText === undefined ? 0 : Number(exponentText);

  return Math.min(MAX_DECIMAL_PRECISION, Math.max(0, decimals - exponent));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Snaps to the nearest step from a finite base, then clears binary drift at
 * the step's decimal precision.
 */
export function normalize(value: number, min: number, max: number, step: number): number {
  const base = Number.isFinite(min) ? min : 0;
  const offset = (value - base) / step;
  const snapped =
    Number.isFinite(step) && step > 0 && Number.isFinite(offset)
      ? Math.round(offset) * step + base
      : value;

  const precision = precisionOf(step);
  const factor = 10 ** precision;
  const scaled = snapped * factor;
  // Keep the established rounding path while it is safe. toFixed avoids
  // turning a finite large value into Infinity when scaling would overflow.
  const rounded = Number.isFinite(scaled)
    ? Math.round(scaled) / factor
    : Number(snapped.toFixed(precision));
  return clamp(rounded, min, max);
}
