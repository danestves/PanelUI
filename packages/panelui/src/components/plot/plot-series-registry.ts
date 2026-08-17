export interface PlotSeriesRegistration {
  key: string;
  colors: readonly string[];
}

export function registerPlotSeries(
  current: readonly PlotSeriesRegistration[],
  key: string,
  color: string
): PlotSeriesRegistration[] {
  const existing = current.find((entry) => entry.key === key);
  if (!existing) return [...current, { key, colors: [color] }];

  return current.map((entry) =>
    entry === existing ? { ...entry, colors: [...entry.colors, color] } : entry
  );
}

export function unregisterPlotSeries(
  current: readonly PlotSeriesRegistration[],
  key: string,
  color?: string
): PlotSeriesRegistration[] {
  const existing = current.find((entry) => entry.key === key);
  if (!existing) return current as PlotSeriesRegistration[];

  const index =
    color === undefined ? existing.colors.length - 1 : existing.colors.lastIndexOf(color);
  if (index < 0) return current as PlotSeriesRegistration[];

  const colors = existing.colors.filter((_, candidate) => candidate !== index);
  if (colors.length === 0) return current.filter((entry) => entry !== existing);

  return current.map((entry) => (entry === existing ? { ...entry, colors } : entry));
}

export function visiblePlotSeries(
  registrations: readonly PlotSeriesRegistration[]
): [string, string][] {
  return registrations.map(({ key, colors }) => [key, colors[colors.length - 1]!]);
}
