/**
 * The dot field's drawing, kept out of the component so it can be checked
 * without a renderer — the same split `progress-button-hold` uses.
 *
 * The field is a grid of dots with a soft region of light wandering across it.
 * A dot near that region is brighter, larger, and pushed a little away from
 * its centre, which is what makes the light read as something passing over the
 * grid rather than as the grid changing colour.
 *
 * Everything here is a worklet: the only runtime that knows what frame it is
 * on is the one drawing it.
 */

/** Points between one dot and the next. */
export const DOT_GAP = 10;

/**
 * How many opacity levels the field is drawn in.
 *
 * Every dot at its own opacity would be one view or one path each, and a field
 * this size has hundreds. Banding them means the whole field is a handful of
 * paths — five native updates a frame instead of five hundred — and at a dot
 * radius of one point the steps between levels are not visible.
 */
export const BANDS = 5;

/** Dots per band index, as an opacity. Matches the ramp below. */
export function bandOpacity(band: number): number {
  'worklet';
  return 0.17 + ((band + 0.5) / BANDS) * 0.72;
}

/** The most dots the field will draw, whatever box it is given. */
const MAX_DOTS = 900;

/**
 * Where the light is, at a given moment.
 *
 * Two periods that do not divide into each other, so the path never closes
 * into a loop the eye can learn. The amplitudes are small — it drifts around
 * the middle rather than touring the box, because a light that reaches the
 * corners stops reading as one source.
 */
export function centreAt(time: number, width: number, height: number): [number, number] {
  'worklet';
  return [
    width / 2 + Math.sin(time / 1700) * width * 0.12,
    height / 2 + Math.cos(time / 2100) * height * 0.1,
  ];
}

/**
 * How strongly a dot at `distance` from the centre is lit.
 *
 * Smoothstep rather than a linear ramp: linear gives the region a hard rim,
 * because the eye finds the discontinuity in the first derivative. This one
 * arrives and leaves at zero slope, so the light has no edge.
 */
export function influenceAt(distance: number, radius: number): number {
  'worklet';
  if (radius <= 0) return 0;
  const proximity = Math.max(0, 1 - distance / radius);
  return proximity * proximity * (3 - 2 * proximity);
}

/** A circle as an SVG subpath, which is two half arcs. */
function circle(x: number, y: number, r: number): string {
  'worklet';
  const d = (r * 2).toFixed(2);
  return `M${(x - r).toFixed(2)},${y.toFixed(2)}a${r},${r} 0 1,0 ${d},0a${r},${r} 0 1,0 -${d},0`;
}

/**
 * The whole field for one frame, as one path per opacity band.
 *
 * Returns `BANDS` strings. A band with no dots in it is an empty string, which
 * react-native-svg draws as nothing.
 */
export function renderField(
  width: number,
  height: number,
  time: number
): string[] {
  'worklet';
  const out: string[] = [];
  for (let band = 0; band < BANDS; band += 1) out.push('');
  if (width <= 0 || height <= 0) return out;

  // The gap opens up rather than the field overflowing: a box big enough to
  // want a thousand dots gets the same picture drawn coarser, which costs the
  // same and looks the same at arm's length.
  const cells = (width / DOT_GAP + 1) * (height / DOT_GAP + 1);
  const gap = cells > MAX_DOTS ? DOT_GAP * Math.sqrt(cells / MAX_DOTS) : DOT_GAP;

  const columns = Math.ceil(width / gap) + 1;
  const rows = Math.ceil(height / gap) + 1;
  // Centred, so the margin is equal on both sides. Laid out from the origin
  // instead, the field ends with a wide strip of nothing down one edge.
  const offsetX = (width - (columns - 1) * gap) / 2;
  const offsetY = (height - (rows - 1) * gap) / 2;

  const [centreX, centreY] = centreAt(time, width, height);
  const radius = Math.min(width, height) * 0.38;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const anchorX = offsetX + column * gap;
      const anchorY = offsetY + row * gap;
      const deltaX = anchorX - centreX;
      const deltaY = anchorY - centreY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const influence = influenceAt(distance, radius);

      // Pushed outward, and squared again so only the dots well inside the
      // light move at all. The grid has to stay a grid — a field where every
      // dot drifts is a texture, not a light passing over one.
      const displacement = influence * influence * 9;
      const directionX = distance > 0 ? deltaX / distance : 0;
      const directionY = distance > 0 ? deltaY / distance : 0;

      const band = Math.min(BANDS - 1, Math.floor(influence * BANDS));
      const size = 0.65 + ((band + 0.5) / BANDS) * 0.85;

      out[band] += circle(
        anchorX + directionX * displacement,
        anchorY + directionY * displacement,
        size
      );
    }
  }

  return out;
}
