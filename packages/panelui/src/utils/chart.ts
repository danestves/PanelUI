/**
 * The maths every chart shares.
 *
 * Scales, monotone tangents and path building, in one place because four
 * charts need them and a copy per chart is four chances for two charts to
 * disagree about where a point goes. A line and an area drawn from different
 * code do not lie on top of each other, and that is exactly the pair most
 * often drawn together.
 *
 * Everything here is a worklet. The paths are rebuilt on the UI thread on
 * every frame a domain is tweening, so none of it can be allowed to need the
 * JS thread — which also rules out reaching for a charting dependency, since
 * that is the one thing none of them are written to survive.
 */

import { useCSSVariable } from 'uniwind';

/** Only reached if the theme CSS was never imported. */
const FALLBACK_SERIES = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

/** Which of the five chart tokens a series takes. */
export type SeriesColorIndex = 1 | 2 | 3 | 4 | 5;

/**
 * A series' colour: an explicit one, else the `--color-chart-*` token.
 *
 * Shared so every chart draws its first series in the same colour. Two charts
 * on one screen disagreeing about what "series one" looks like is the kind of
 * thing nobody reports and everybody notices.
 */
export function useSeriesColor(
  explicit: string | undefined,
  index: SeriesColorIndex
): string {
  const token = useCSSVariable(`--color-chart-${index}`);
  return explicit ?? (typeof token === 'string' ? token : FALLBACK_SERIES[index - 1]!);
}

/** `12.4k` rather than `12400` — a readout has one line to say it in. */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** The drawable box inside a chart, after its padding is taken off. */
export interface Plot {
  width: number;
  height: number;
  left: number;
  top: number;
}

/** A point's x, spreading `total` of them evenly across the plot. */
export function xOf(index: number, total: number, plot: Plot): number {
  'worklet';
  if (total <= 1) return plot.left + plot.width / 2;
  return plot.left + (plot.width * index) / (total - 1);
}

/** A value's y, with `min` at the bottom of the plot and `max` at the top. */
export function yOf(value: number, plot: Plot, min: number, max: number): number {
  'worklet';
  const span = max - min || 1;
  return plot.top + plot.height - ((value - min) / span) * plot.height;
}

/**
 * A value's x on a *measured* axis, with `min` at the left edge and `max` at
 * the right.
 *
 * The counterpart to `xOf`, and not a replacement for it. `xOf` spreads points
 * evenly by position, which is what a time series wants — twelve months are
 * twelve equal steps whatever the gaps between the dates behind them. This one
 * places a point at the value it holds, which is what a scatter plot needs: the
 * whole claim of a scatter plot is that both coordinates are quantities, and
 * spacing its points evenly would throw away the one axis the reader is being
 * asked to look for a relationship along.
 */
export function xAt(value: number, plot: Plot, min: number, max: number): number {
  'worklet';
  const span = max - min || 1;
  return plot.left + ((value - min) / span) * plot.width;
}

/** The centre of the `index`th of `total` bands, as used for bars and columns. */
export function bandOf(index: number, total: number, plot: Plot): number {
  'worklet';
  if (total <= 0) return plot.left + plot.width / 2;
  const width = plot.width / total;
  return plot.left + width * (index + 0.5);
}

/**
 * Monotone cubic tangents.
 *
 * Written out rather than taken from a charting dependency, because it is forty
 * lines and it has to run inside a worklet.
 *
 * Monotone is the right default for a time series. A plain cubic spline
 * overshoots between points, so a series that never goes below zero draws a dip
 * under the axis between two low values — a shape that is not in the data. This
 * one cannot, because the tangent at each point is clamped against the slopes
 * either side of it, and a local peak or trough is given a flat one.
 */
export function tangents(xs: number[], ys: number[]): number[] {
  'worklet';
  const n = xs.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    slopes.push((ys[i + 1]! - ys[i]!) / (xs[i + 1]! - xs[i]! || 1));
  }

  const result: number[] = new Array(n).fill(0);
  result[0] = slopes[0] ?? 0;
  result[n - 1] = slopes[n - 2] ?? 0;

  for (let i = 1; i < n - 1; i += 1) {
    const previous = slopes[i - 1]!;
    const next = slopes[i]!;
    result[i] = previous * next <= 0 ? 0 : (previous + next) / 2;
  }

  // Fritsch–Carlson: pull any tangent back inside the circle of radius 3, which
  // is the condition for the segment to stay monotone.
  for (let i = 0; i < n - 1; i += 1) {
    const slope = slopes[i]!;
    if (slope === 0) {
      result[i] = 0;
      result[i + 1] = 0;
      continue;
    }
    const a = result[i]! / slope;
    const b = result[i + 1]! / slope;
    const magnitude = Math.sqrt(a * a + b * b);
    if (magnitude > 3) {
      result[i] = (3 / magnitude) * a * slope;
      result[i + 1] = (3 / magnitude) * b * slope;
    }
  }

  return result;
}

/** How a series is joined between its points. */
export type ChartCurve = 'monotone' | 'linear';

export interface ChartPoint {
  x: number;
  y: number;
}

/** Points, split at the gaps — a null breaks the series rather than crossing it. */
export function runsOf(
  values: (number | null)[],
  plot: Plot,
  min: number,
  max: number,
  /** Baselines to stack each point on top of, for a stacked area. */
  baselines?: number[]
): ChartPoint[][] {
  'worklet';
  const runs: ChartPoint[][] = [];
  let run: ChartPoint[] = [];

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === null || value === undefined) {
      if (run.length) runs.push(run);
      run = [];
      continue;
    }
    const stacked = value + (baselines?.[i] ?? 0);
    run.push({ x: xOf(i, values.length, plot), y: yOf(stacked, plot, min, max) });
  }
  if (run.length) runs.push(run);
  return runs;
}

/** One unbroken run of points as a path, curved or straight. */
export function segment(points: ChartPoint[], curve: ChartCurve): string {
  'worklet';
  if (!points.length) return '';
  if (points.length < 3 || curve === 'linear') {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const ms = tangents(xs, ys);

  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const dx = (xs[i + 1]! - xs[i]!) / 3;
    d += ` C${xs[i]! + dx},${ys[i]! + ms[i]! * dx} ${xs[i + 1]! - dx},${ys[i + 1]! - ms[i + 1]! * dx} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

/** A series as a stroked line. Flat down the middle while it is still loading. */
export function linePath(
  values: (number | null)[],
  plot: Plot,
  min: number,
  max: number,
  curve: ChartCurve,
  loading: boolean,
  baselines?: number[]
): string {
  'worklet';
  if (loading || plot.width <= 0) {
    // Flat down the middle: the shape the skeleton holds, and the shape the
    // real series grows out of once the data arrives.
    const y = plot.top + plot.height / 2;
    return `M${plot.left},${y} L${plot.left + plot.width},${y}`;
  }
  return runsOf(values, plot, min, max, baselines)
    .map((run) => segment(run, curve))
    .join(' ');
}

/**
 * A series as a filled area.
 *
 * `floors` is what makes a stack: without it every run is closed against the
 * bottom of the plot, and with it each run is closed against the series below,
 * so the bands sit on each other rather than overlapping. The floor is walked
 * backwards because the fill has to trace its underside right to left to close.
 */
export function areaPath(
  values: (number | null)[],
  plot: Plot,
  min: number,
  max: number,
  curve: ChartCurve,
  loading: boolean,
  baselines?: number[]
): string {
  'worklet';
  if (loading || plot.width <= 0) return '';

  const bottom = plot.top + plot.height;
  const runs = runsOf(values, plot, min, max, baselines);

  if (!baselines) {
    return runs
      .map((run) => {
        const top = segment(run, curve);
        if (!top) return '';
        const first = run[0]!;
        const last = run[run.length - 1]!;
        return `${top} L${last.x},${bottom} L${first.x},${bottom} Z`;
      })
      .join(' ');
  }

  // Stacked: the underside is the baseline itself, drawn as its own curve so
  // the two edges of a band meet cleanly at both ends.
  const floors = runsOf(
    values.map((value) => (value === null || value === undefined ? null : 0)),
    plot,
    min,
    max,
    baselines
  );

  return runs
    .map((run, index) => {
      const top = segment(run, curve);
      const floor = floors[index];
      if (!top || !floor?.length) return '';
      const under = segment([...floor].reverse(), curve).replace('M', 'L');
      return `${top} ${under} Z`;
    })
    .join(' ');
}

/**
 * A rounded rectangle, built as a path rather than drawn as a `Rect`.
 *
 * A bar is rounded on the end it grows towards and square on the end it grows
 * from, so it reads as sitting on the axis rather than floating above it —
 * which `rx` cannot express, since it rounds all four corners or none.
 */
export function barPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  /** Which end is the growing one. */
  towards: 'up' | 'down' | 'left' | 'right'
): string {
  'worklet';
  if (width <= 0 || height <= 0) return '';
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const right = x + width;
  const bottom = y + height;

  if (towards === 'up') {
    return (
      `M${x},${bottom}L${x},${y + r}Q${x},${y} ${x + r},${y}` +
      `L${right - r},${y}Q${right},${y} ${right},${y + r}L${right},${bottom}Z`
    );
  }
  if (towards === 'down') {
    return (
      `M${x},${y}L${x},${bottom - r}Q${x},${bottom} ${x + r},${bottom}` +
      `L${right - r},${bottom}Q${right},${bottom} ${right},${bottom - r}L${right},${y}Z`
    );
  }
  if (towards === 'right') {
    return (
      `M${x},${y}L${right - r},${y}Q${right},${y} ${right},${y + r}` +
      `L${right},${bottom - r}Q${right},${bottom} ${right - r},${bottom}L${x},${bottom}Z`
    );
  }
  return (
    `M${right},${y}L${x + r},${y}Q${x},${y} ${x},${y + r}` +
    `L${x},${bottom - r}Q${x},${bottom} ${x + r},${bottom}L${right},${bottom}Z`
  );
}

/**
 * An arc of a circle, as a path.
 *
 * Angles are in turns from twelve o'clock, clockwise, because that is how a
 * ring chart is described — "sixty percent of the way round" — and converting
 * at every call site is where the sign errors live.
 */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  from: number,
  to: number
): string {
  'worklet';
  const sweep = to - from;
  if (radius <= 0 || sweep <= 0) return '';

  // A full turn cannot be drawn as one arc — start and end are the same point,
  // and the renderer draws nothing rather than everything. Two halves can.
  if (sweep >= 1) {
    const top = `${cx},${cy - radius}`;
    const bottomPoint = `${cx},${cy + radius}`;
    return (
      `M${top}A${radius},${radius} 0 0 1 ${bottomPoint}` +
      `A${radius},${radius} 0 0 1 ${top}`
    );
  }

  const angle = (turn: number) => (turn - 0.25) * Math.PI * 2;
  const x1 = cx + radius * Math.cos(angle(from));
  const y1 = cy + radius * Math.sin(angle(from));
  const x2 = cx + radius * Math.cos(angle(to));
  const y2 = cy + radius * Math.sin(angle(to));

  return `M${x1},${y1}A${radius},${radius} 0 ${sweep > 0.5 ? 1 : 0} 1 ${x2},${y2}`;
}

/**
 * A filled slice of an annulus, as a path.
 *
 * `arcPath` above cannot express this: it draws a line to be stroked, and a
 * stroke is a band of even thickness with no ends of its own. A slice is a
 * region — bounded by two arcs and two radial edges — and only a closed path
 * can be filled as one.
 *
 * `inner` of zero gives the pie's wedge, closing on the centre rather than on a
 * second arc. Anything above it gives the donut's, and the two are worth being
 * one function: a donut is not a pie with a circle painted over the middle,
 * because a slice pushed out of a donut has to be hollow along its whole length.
 *
 * `corner` rounds the four turns of a slice, and rounds them with a quadratic
 * through the sharp corner rather than with a true fillet arc. The two are
 * indistinguishable at the radii a slice is drawn at, and the quadratic cannot
 * degenerate at a narrow slice the way solving for tangent points does — which
 * matters here, because the narrow slices are exactly the ones a reader is
 * least able to check.
 */
export function wedgePath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  from: number,
  to: number,
  corner: number
): string {
  'worklet';
  const sweep = to - from;
  if (outer <= 0 || sweep <= 0) return '';

  const at = (turn: number, radius: number) => {
    const angle = (turn - 0.25) * Math.PI * 2;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  };

  const ring = Math.max(0, Math.min(inner, outer));

  /*
   * A full turn cannot be drawn as one arc — its start and end are the same
   * point, and the renderer draws nothing rather than everything. Two halves
   * can, and the hole in a full donut comes from tracing the inner circle the
   * other way round: under the nonzero fill rule an opposed subpath is a hole,
   * with no fill rule to set and no second element to keep in step.
   */
  if (sweep >= 1) {
    const disc =
      `M${at(0, outer)}A${outer},${outer} 0 1 1 ${at(0.5, outer)}` +
      `A${outer},${outer} 0 1 1 ${at(0, outer)}Z`;
    if (ring <= 0) return disc;
    return (
      `${disc}M${at(0, ring)}A${ring},${ring} 0 1 0 ${at(0.5, ring)}` +
      `A${ring},${ring} 0 1 0 ${at(0, ring)}Z`
    );
  }

  // Never more than half the slice from each end, or the two roundings meet in
  // the middle and cross; never more than half the band, or the outer rounding
  // reaches past the inner edge.
  const band = ring > 0 ? outer - ring : outer;
  const k = Math.max(0, Math.min(corner, band / 2, sweep * outer * Math.PI));
  const outerInset = Math.min(k / (outer * Math.PI * 2), sweep / 2);
  const innerInset = ring > 0 ? Math.min(k / (ring * Math.PI * 2), sweep / 2) : 0;
  const large = sweep - 2 * outerInset > 0.5 ? 1 : 0;

  const outerStart = from + outerInset;
  const outerEnd = to - outerInset;

  if (ring <= 0) {
    // A wedge closes on the centre, and its apex stays sharp: rounding a point
    // that three slices share opens a hole in the middle of the chart.
    return (
      `M${cx},${cy}L${at(from, outer - k)}Q${at(from, outer)} ${at(outerStart, outer)}` +
      `A${outer},${outer} 0 ${large} 1 ${at(outerEnd, outer)}` +
      `Q${at(to, outer)} ${at(to, outer - k)}Z`
    );
  }

  return (
    `M${at(outerStart, outer)}A${outer},${outer} 0 ${large} 1 ${at(outerEnd, outer)}` +
    `Q${at(to, outer)} ${at(to, outer - k)}` +
    `L${at(to, ring + k)}` +
    `Q${at(to, ring)} ${at(to - innerInset, ring)}` +
    `A${ring},${ring} 0 ${large} 0 ${at(from + innerInset, ring)}` +
    `Q${at(from, ring)} ${at(from, ring + k)}` +
    `L${at(from, outer - k)}` +
    `Q${at(from, outer)} ${at(outerStart, outer)}Z`
  );
}

/**
 * A point at `radius` from the centre, `turn` of the way round.
 *
 * Turns from twelve o'clock, clockwise, matching `arcPath` — a radar's axes
 * and a ring's arcs are described the same way, and two polar conventions in
 * one file is how a spoke ends up a quarter turn from its own label.
 */
export function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  turn: number
): { x: number; y: number } {
  'worklet';
  const angle = (turn - 0.25) * Math.PI * 2;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

/**
 * A closed polygon through evenly spaced spokes.
 *
 * `values` are already scaled to 0…1 — the fraction of the full radius each
 * axis reaches. A `null` is a missing reading rather than a zero: a radar with
 * a hole punched through to its centre says "none of this" when what happened
 * was "we did not measure this", so the gap is bridged by its neighbours and
 * the shape stays a shape.
 */
export function radarPath(
  values: (number | null)[],
  cx: number,
  cy: number,
  radius: number
): string {
  'worklet';
  const count = values.length;
  if (count < 3 || radius <= 0) return '';

  let path = '';
  let drawn = 0;

  for (let index = 0; index < count; index += 1) {
    const value = values[index];
    if (value === null || value === undefined) continue;
    const point = polarPoint(cx, cy, radius * value, index / count);
    path += `${drawn === 0 ? 'M' : 'L'}${point.x},${point.y}`;
    drawn += 1;
  }

  if (drawn < 3) return '';
  return `${path}Z`;
}

/** The numbers of one column, with anything unusable left as a gap. */
export function columnValues(
  data: Record<string, unknown>[],
  key: string
): (number | null)[] {
  'worklet';
  return data.map((row) => {
    const value = row[key];
    return typeof value === 'number' && !Number.isNaN(value) ? value : null;
  });
}
