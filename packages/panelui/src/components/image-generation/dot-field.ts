/**
 * The dot field's drawing, kept out of the component so it can be checked
 * without a renderer — the same split `progress-button-hold` uses.
 *
 * ## Nothing is built while it is running
 *
 * The field is hundreds of dots and it is on screen for as long as a model
 * takes to answer, on a page that may be showing several at once. So every
 * frame it will ever draw is built when the box is measured, and playing it is
 * handing react-native-svg a string that already exists.
 *
 * Two earlier versions did this the obvious ways and both stalled a page of
 * them on scroll: one rebuilt every dot as a path string on every frame, the
 * other clipped a moving shape of light to a path with hundreds of subpaths in
 * it, which is re-rasterized every time the view is drawn.
 */

/** Points between one dot and the next. */
export const DOT_GAP = 10;

/** The dot's radius where the light is not, and where it is strongest. */
export const DOT_RADIUS = 1;
export const DOT_LIT_RADIUS = 1.9;

/** How visible the resting grid is, under everything. */
export const DOT_REST_OPACITY = 0.16;

/** How many still frames one loop is drawn as. */
export const FRAMES = 24;

/**
 * The most dots the field will draw, whatever box it is given.
 *
 * The grid opens up rather than the count running away: a full-width field on
 * a tablet gets the same picture drawn coarser, which costs the same and looks
 * the same at arm's length.
 */
const MAX_DOTS = 700;

/** How the light moves through the field. */
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
 * Every dot's anchor, in reading order.
 *
 * Laid out inside the box by the widest a dot can be drawn, and counted with
 * `floor` rather than `ceil`, so no part of any dot falls outside it.
 *
 * Counted with `ceil` the grid overhangs by up to half a gap on every side.
 * That is invisible while the light stays near the middle and obvious the
 * moment it reaches an edge — which the scanning band does by design, and a
 * short wide box does simply by being short. The dots then draw outside the
 * card, which looks like the animation has escaped it.
 *
 * The row and column are still centred in whatever is left over, because laid
 * out from the origin the field ends with a strip of nothing down one edge.
 */
function anchors(width: number, height: number): [number, number][] {
  const gap = gapFor(width, height);
  const margin = DOT_LIT_RADIUS;
  const innerWidth = Math.max(0, width - margin * 2);
  const innerHeight = Math.max(0, height - margin * 2);

  const columns = Math.floor(innerWidth / gap) + 1;
  const rows = Math.floor(innerHeight / gap) + 1;
  const offsetX = margin + (innerWidth - (columns - 1) * gap) / 2;
  const offsetY = margin + (innerHeight - (rows - 1) * gap) / 2;

  const out: [number, number][] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      out.push([offsetX + column * gap, offsetY + row * gap]);
    }
  }
  return out;
}

/** The resting grid as one path. Drawn once, under the light. */
export function gridPath(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '';
  let path = '';
  for (const [x, y] of anchors(width, height)) path += circle(x, y, DOT_RADIUS);
  return path;
}

/** How many dots {@link gridPath} would draw for a box. */
export function dotCount(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 0;
  return anchors(width, height).length;
}

/**
 * How strongly a dot at `distance` from the light is lit.
 *
 * Smoothstep rather than a linear ramp: linear gives the light a hard rim,
 * because the eye finds the discontinuity in the first derivative. This one
 * arrives and leaves at zero slope, so the light has no edge.
 */
export function influenceAt(distance: number, radius: number): number {
  if (radius <= 0) return 0;
  const proximity = Math.max(0, 1 - distance / radius);
  return proximity * proximity * (3 - 2 * proximity);
}

/**
 * Where the light is at a phase of the loop, and how wide it reaches.
 *
 * `drift` wanders around the middle — two periods that do not divide into each
 * other, so the path never closes into a loop the eye can learn, and small
 * amplitudes because a light that reaches the corners stops reading as one
 * source. `pulse` is a ring leaving the centre. `scan` crosses as a band, which
 * is the same maths with the light infinitely tall.
 */
function lightAt(
  animation: DotFieldAnimation,
  phase: number,
  width: number,
  height: number
): { x: number; y: number; radius: number; ring: number } {
  const short = Math.min(width, height);
  const turn = phase * Math.PI * 2;

  if (animation === 'pulse') {
    const reach = Math.sqrt(width * width + height * height) / 2;
    return { x: width / 2, y: height / 2, radius: short * 0.3, ring: phase * reach };
  }

  if (animation === 'scan') {
    // A band: infinitely tall, so only the horizontal distance counts.
    //
    // It starts and ends half a band clear of the edges rather than a whole
    // one — far enough to ramp in and out, near enough that some of it is
    // always on the field. Travelling fully off, the loop spends several
    // frames drawing nothing at all, which reads as the component having
    // stopped rather than as a band that has passed.
    const radius = width * 0.28;
    return {
      x: -radius * 0.5 + phase * (width + radius),
      y: Number.NaN,
      radius,
      ring: 0,
    };
  }

  return {
    x: width / 2 + Math.sin(turn) * width * 0.26,
    y: height / 2 + Math.cos(turn * 1.37) * height * 0.22,
    radius: short * 0.42,
    ring: 0,
  };
}

/**
 * The lit dots at one phase of the loop, as a path.
 *
 * Only the dots the light actually reaches are in it — the rest are already
 * drawn by the resting grid underneath, so this is a fraction of the field
 * rather than all of it.
 */
export function litPath(
  width: number,
  height: number,
  phase: number,
  animation: DotFieldAnimation = 'drift'
): string {
  if (width <= 0 || height <= 0) return '';

  const light = lightAt(animation, phase, width, height);
  let path = '';

  for (const [x, y] of anchors(width, height)) {
    const deltaX = x - light.x;
    const deltaY = Number.isNaN(light.y) ? 0 : y - light.y;
    const distance = Math.abs(
      Math.sqrt(deltaX * deltaX + deltaY * deltaY) - light.ring
    );
    const influence = influenceAt(distance, light.radius);
    if (influence <= 0.02) continue;
    path += circle(x, y, DOT_RADIUS + influence * (DOT_LIT_RADIUS - DOT_RADIUS));
  }

  return path;
}

/**
 * Every frame of the loop, built once.
 *
 * A still frame the light is somewhere legible in is also what a paused or
 * reduced-motion field shows, so there is no separate code path for holding it.
 */
export function litFrames(
  width: number,
  height: number,
  animation: DotFieldAnimation = 'drift'
): string[] {
  return Array.from({ length: FRAMES }, (_unused, index) =>
    litPath(width, height, index / FRAMES, animation)
  );
}

/** One pass of the loop, in milliseconds, per animation. */
export const PERIOD: Record<DotFieldAnimation, number> = {
  drift: 4200,
  pulse: 2200,
  scan: 1900,
};

/** Which frame a moment falls on. */
export function frameAt(time: number, animation: DotFieldAnimation): number {
  'worklet';
  const phase = (time % PERIOD[animation]) / PERIOD[animation];
  return Math.min(FRAMES - 1, Math.floor(phase * FRAMES));
}
