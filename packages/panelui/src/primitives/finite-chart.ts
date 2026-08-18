/** Returns a number only when it is safe to use in chart arithmetic. */
export function finiteChartNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Accepts an explicit domain only when both ends are finite. */
export function finiteChartDomain(
  domain: readonly [number, number] | undefined
): [number, number] | undefined {
  if (!domain) return undefined;
  const low = finiteChartNumber(domain[0]);
  const high = finiteChartNumber(domain[1]);
  return low === undefined || high === undefined ? undefined : [low, high];
}
