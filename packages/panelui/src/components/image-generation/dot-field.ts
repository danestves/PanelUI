/**
 * The dot field's geometry, kept out of the component so it can be checked
 * without a renderer — the same split `progress-button-hold` uses.
 *
 * ## Why the grid is drawn once
 *
 * The field is hundreds of dots and it is on screen for as long as a model
 * takes to answer, which on a page showing several at once is the difference
 * between a placeholder and a stall. So nothing about the dots themselves is
 * animated: the grid is one path, built when the box is measured and not
 * touched again.
 *
 * What moves is a single shape of light behind it, clipped to that path. Two
 * numbers a frame for the whole field, whatever its size — and the dots are
 * lit rather than redrawn, which is also what they look like.
 */

/** Points between one dot and the next. */
export const DOT_GAP = 10;

/** The dot's radius at rest. */
export const DOT_RADIUS = 1.1;

/** How visible a dot is where the light is not. */
export const DOT_REST_OPACITY = 0.16;

/**
 * The most dots the field will draw, whatever box it is given.
 *
 * The grid opens up rather than the count running away: a full-width field on
 * a tablet gets the same picture drawn coarser, which costs the same and looks
 * the same at arm's length.
 */
const MAX_DOTS = 900;

/** How the light behind the dots moves. */
export type DotFieldAnimation = 'drift' | 'pulse' | 'scan';

/** The gap this box is drawn at, opened up if the grid would be too dense. */
export function gapFor(width: number, height: number): number {
  if (width <= 0 || height <= 0) return DOT_GAP;
  const cells = (width / DOT_GAP + 1) * (height / DOT_GAP + 1);
  return cells > MAX_DOTS ? DOT_GAP * Math.sqrt(cells / MAX_DOTS) : DOT_GAP;
}

/** A circle as an SVG subpath, which is two half arcs. */
function circle(x: number, y: number, r: number): string {
  const d = (r * 2).toFixed(2);
  return `M${(x - r).toFixed(2)},${y.toFixed(2)}a${r},${r} 0 1,0 ${d},0a${r},${r} 0 1,0 -${d},0`;
}

/**
 * The whole grid as one path.
 *
 * Built once per size. Centred, so the margin is equal on both sides — laid
 * out from the origin instead, the field ends with a wide strip of nothing
 * down one edge.
 */
export function gridPath(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '';

  const gap = gapFor(width, height);
  const columns = Math.ceil(width / gap) + 1;
  const rows = Math.ceil(height / gap) + 1;
  const offsetX = (width - (columns - 1) * gap) / 2;
  const offsetY = (height - (rows - 1) * gap) / 2;

  let path = '';
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      path += circle(offsetX + column * gap, offsetY + row * gap, DOT_RADIUS);
    }
  }
  return path;
}

/** How many dots {@link gridPath} would draw for a box. */
export function dotCount(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0;
  const gap = gapFor(width, height);
  return (Math.ceil(width / gap) + 1) * (Math.ceil(height / gap) + 1);
}

/**
 * How wide the light is, as a radius.
 *
 * A fraction of the shorter side, so it stays the same size relative to the
 * box rather than swelling on a wide one — the light is meant to read as
 * something crossing the field, and one that spans the whole field is just a
 * brighter field.
 */
export function lightRadius(width: number, height: number): number {
  return Math.min(width, height) * 0.42;
}

/**
 * Where the drifting light is, at a given moment.
 *
 * Two periods that do not divide into each other, so the path never closes
 * into a loop the eye can learn. The amplitudes are small: it drifts around
 * the middle rather than touring the box, because a light that reaches the
 * corners stops reading as one source.
 */
export function driftAt(time: number, width: number, height: number): [number, number] {
  'worklet';
  return [
    width / 2 + Math.sin(time / 1700) * width * 0.12,
    height / 2 + Math.cos(time / 2100) * height * 0.1,
  ];
}

/** One pass of the pulse, in milliseconds. */
export const PULSE_PERIOD = 2200;

/**
 * How far out the pulse's ring has travelled, as `0` to `1` of the light's
 * radius.
 *
 * A ring leaving the centre, so the field reads as something being developed
 * outward from the middle rather than swept across. It is a ring rather than a
 * growing disc because a disc that reaches the edge and restarts is a flash;
 * a ring simply leaves, and the next one starting at the centre is the same
 * event happening again.
 */
export function pulseAt(time: number): number {
  'worklet';
  return (time % PULSE_PERIOD) / PULSE_PERIOD;
}

/** One pass of the scan, in milliseconds. */
export const SCAN_PERIOD = 1900;

/**
 * How far across the box the scan band has reached, as `0` to `1`.
 *
 * It starts and ends clear of the box so the band ramps in and out at the
 * edges rather than appearing at full strength against them.
 */
export function scanAt(time: number): number {
  'worklet';
  return (time % SCAN_PERIOD) / SCAN_PERIOD;
}
