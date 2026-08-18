const DEFAULT_MAX = 5;
const DEFAULT_PRECISION = 1;

export function normalizeRatingMax(max: number | undefined): number {
  return typeof max === 'number' && Number.isFinite(max) && max >= 1
    ? Math.floor(max)
    : DEFAULT_MAX;
}

export function normalizeRatingPrecision(precision: number | undefined): number {
  return typeof precision === 'number' && Number.isFinite(precision) && precision > 0
    ? precision
    : DEFAULT_PRECISION;
}

export function normalizeRatingValue(value: number | undefined, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}
