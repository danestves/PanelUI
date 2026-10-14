/**
 * The geometry behind the avatar cropper, kept apart from the component.
 *
 * The mask stays fixed in the middle of the canvas and the photo moves under
 * it, so everything here is one question asked different ways: where is the
 * mask, measured in the photo's own frame? Clamping asks it to keep the mask
 * on the photo — or, when the photo may be smaller than the mask, the photo
 * inside the mask — and the export asks it to find the same square in the
 * photo's pixels.
 *
 * The photo is drawn at a base size whose short side equals the mask, then
 * moved by `x`/`y`, turned by `rotation` and scaled by `scale` about its own
 * centre — the order React Native applies `translate`, `rotate`, `scale` in a
 * transform. Every function runs on the UI thread inside a gesture or an
 * animated style, so each is a worklet, and none touches React Native, which
 * is what lets the contract tests run them in Node.
 */

export type CropShape = 'circle' | 'squircle' | 'square';

export interface Size {
  width: number;
  height: number;
}

/** Where the photo sits under the mask. Rotation is in degrees, clockwise. */
export interface CropState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

/** The fixed parts: the mask's side, and the photo's size at a scale of 1. */
export interface CropFrame {
  mask: number;
  image: Size;
}

/** A crop in the source's pixels, after the source is turned by `rotation`. */
export interface SourceCrop {
  /** The rectangle to cut, in the turned image's pixels. Always square. */
  originX: number;
  originY: number;
  width: number;
  height: number;
  /** Degrees to turn the source by first, clockwise, in (-180, 180]. */
  rotation: number;
  /** The size of the turned image the rectangle is measured in. */
  canvas: Size;
}

export const IDENTITY: CropState = { x: 0, y: 0, scale: 1, rotation: 0 };

/** How much a rubber-banded overshoot gives. Lower is stiffer. */
const RUBBER_BAND = 0.55;

/** Below this a sine or cosine is taken as zero, so a quarter turn is exact. */
const EPSILON = 1e-9;

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

function trig(degrees: number): { cos: number; sin: number } {
  'worklet';
  const radians = (degrees * Math.PI) / 180;
  let cos = Math.cos(radians);
  let sin = Math.sin(radians);
  if (Math.abs(cos) < EPSILON) cos = 0;
  if (Math.abs(sin) < EPSILON) sin = 0;
  return { cos, sin };
}

/** An angle folded into (-180, 180]. */
export function normalizeDegrees(degrees: number): number {
  'worklet';
  let folded = degrees % 360;
  if (folded <= -180) folded += 360;
  if (folded > 180) folded -= 360;
  return folded;
}

/** The photo's size at a scale of 1: its short side exactly covers the mask. */
export function baseSize(source: Size, mask: number): Size {
  'worklet';
  const shortSide = Math.min(source.width, source.height);
  if (shortSide <= 0 || mask <= 0) return { width: mask, height: mask };
  const factor = mask / shortSide;
  return { width: source.width * factor, height: source.height * factor };
}

/**
 * Half the mask's extent along the photo's axes, in screen points.
 *
 * A circle reaches the same distance whichever way the photo is turned. A
 * square turned against the photo reaches further — out to its corners — and
 * the squircle is held to its square, which contains it, so its corners can
 * never come off the photo either.
 */
export function maskReach(shape: CropShape, mask: number, rotation: number): number {
  'worklet';
  const half = mask / 2;
  if (shape === 'circle') return half;
  const { cos, sin } = trig(rotation);
  return half * (Math.abs(cos) + Math.abs(sin));
}

/**
 * The limits a crop is held to.
 *
 * With `cover` on, the photo always fills the mask. With it off, the photo may
 * also be smaller than the mask, down to `minZoom` — its long side as a
 * fraction of the mask's — and a smaller photo is kept inside the mask rather
 * than on it.
 */
export interface CropBounds {
  shape: CropShape;
  maxZoom: number;
  cover: boolean;
  minZoom: number;
}

/** The smallest scale the photo may settle at. */
export function minScale(bounds: CropBounds, frame: CropFrame, rotation: number): number {
  'worklet';
  // The base size's short side is the mask, so covering the reach on the
  // short side covers it on the long one too.
  const covering = maskReach(bounds.shape, 2, rotation);
  if (bounds.cover) return covering;
  const longSide = Math.max(frame.image.width, frame.image.height);
  if (longSide <= 0) return covering;
  return Math.min(covering, (bounds.minZoom * frame.mask) / longSide);
}

/** Screen offset → the same offset along the photo's axes, and back. */
function toImageAxes(x: number, y: number, rotation: number): { u: number; v: number } {
  'worklet';
  const { cos, sin } = trig(rotation);
  return { u: cos * x + sin * y, v: -sin * x + cos * y };
}

function fromImageAxes(u: number, v: number, rotation: number): { x: number; y: number } {
  'worklet';
  const { cos, sin } = trig(rotation);
  return { x: cos * u - sin * v, y: sin * u + cos * v };
}

/**
 * How far the photo can move along each of its own axes.
 *
 * On an axis where the photo is larger than the mask's reach, the mask has to
 * stay on the photo. On one where it is smaller — only possible with `cover`
 * off — the photo has to stay inside the reach instead. Both are the gap
 * between the two half-lengths, which is why one expression covers both.
 */
function travel(state: CropState, bounds: CropBounds, frame: CropFrame): { u: number; v: number } {
  'worklet';
  const reach = maskReach(bounds.shape, frame.mask, state.rotation);
  const u = (state.scale * frame.image.width) / 2 - reach;
  const v = (state.scale * frame.image.height) / 2 - reach;
  return bounds.cover
    ? { u: Math.max(0, u), v: Math.max(0, v) }
    : { u: Math.abs(u), v: Math.abs(v) };
}

/** The nearest translation inside the bounds. */
export function clampTranslation(
  state: CropState,
  bounds: CropBounds,
  frame: CropFrame
): { x: number; y: number } {
  'worklet';
  const limit = travel(state, bounds, frame);
  const along = toImageAxes(state.x, state.y, state.rotation);
  return fromImageAxes(
    clamp(along.u, -limit.u, limit.u),
    clamp(along.v, -limit.v, limit.v),
    state.rotation
  );
}

/** The state a gesture settles into: in range, and inside the bounds. */
export function settle(state: CropState, bounds: CropBounds, frame: CropFrame): CropState {
  'worklet';
  const lowest = minScale(bounds, frame, state.rotation);
  const scale = clamp(state.scale, lowest, Math.max(lowest, bounds.maxZoom));
  const next = { ...state, scale };
  return { ...next, ...clampTranslation(next, bounds, frame) };
}

/**
 * True when every point of the mask is on the photo — when a crop needs no
 * background at all. Always true with `cover` on, once settled.
 */
export function coversMask(state: CropState, shape: CropShape, frame: CropFrame): boolean {
  'worklet';
  const reach = maskReach(shape, frame.mask, state.rotation);
  const along = toImageAxes(state.x, state.y, state.rotation);
  const slack = 0.5;
  return (
    Math.abs(along.u) <= (state.scale * frame.image.width) / 2 - reach + slack &&
    Math.abs(along.v) <= (state.scale * frame.image.height) / 2 - reach + slack
  );
}

/** An overshoot past a bound, compressed so it gives but never runs away. */
export function rubberBand(overshoot: number, dimension: number): number {
  'worklet';
  if (dimension <= 0) return 0;
  const sign = overshoot < 0 ? -1 : 1;
  const distance = Math.abs(overshoot);
  return sign * (1 - 1 / ((distance * RUBBER_BAND) / dimension + 1)) * dimension;
}

/**
 * What to draw while a gesture is still going: the raw state, with anything
 * past a bound rubber-banded back towards it. At rest the raw state is already
 * settled and this returns it unchanged.
 */
export function present(state: CropState, bounds: CropBounds, frame: CropFrame): CropState {
  'worklet';
  const lowest = minScale(bounds, frame, state.rotation);
  const highest = Math.max(lowest, bounds.maxZoom);
  let scale = state.scale;
  if (scale < lowest) scale = lowest - rubberBand(lowest - scale, lowest / 2);
  else if (scale > highest) scale = highest + rubberBand(scale - highest, highest / 2);

  const next = { ...state, scale };
  const limit = travel(next, bounds, frame);
  const along = toImageAxes(state.x, state.y, state.rotation);
  const u = clamp(along.u, -limit.u, limit.u);
  const v = clamp(along.v, -limit.v, limit.v);
  const offset = fromImageAxes(
    u + rubberBand(along.u - u, frame.mask),
    v + rubberBand(along.v - v, frame.mask),
    state.rotation
  );
  return { ...next, ...offset };
}

/** Scale by `factor` about a point, given relative to the canvas centre. */
export function zoomAbout(state: CropState, factor: number, fx: number, fy: number): CropState {
  'worklet';
  return {
    ...state,
    scale: state.scale * factor,
    x: fx + (state.x - fx) * factor,
    y: fy + (state.y - fy) * factor,
  };
}

/** Turn by `degrees` about a point, given relative to the canvas centre. */
export function rotateAbout(state: CropState, degrees: number, ax: number, ay: number): CropState {
  'worklet';
  const { cos, sin } = trig(degrees);
  const dx = state.x - ax;
  const dy = state.y - ay;
  return {
    ...state,
    rotation: state.rotation + degrees,
    x: ax + cos * dx - sin * dy,
    y: ay + sin * dx + cos * dy,
  };
}

/** The next quarter turn from wherever the photo is, in either direction. */
export function nextQuarterTurn(rotation: number, direction: 1 | -1): number {
  'worklet';
  const quarters = rotation / 90;
  const nearest = Math.round(quarters);
  // Already on a quarter turn: step a whole one. Part way: finish this one.
  const onQuarter = Math.abs(quarters - nearest) < 1e-6;
  const base = onQuarter ? nearest : direction > 0 ? Math.floor(quarters) : Math.ceil(quarters);
  return (base + direction) * 90;
}

/**
 * The square the mask covers, in the source's pixels.
 *
 * The export turns the source first and cuts an upright square from the
 * result, because a turned square cannot be cut directly. Turning grows the
 * canvas to the turned image's bounding box with the image still centred, and
 * a point at `p` from the source's centre lands at `R(θ)·p` from the canvas
 * centre. The mask's centre sits at `R(−θ)·(−x, −y) / scale` in the photo, so
 * after the turn it lands at `−(x, y) / scale` — the rotation cancels, and the
 * crop is the mask's offset scaled into pixels.
 */
export function sourceCrop(
  state: CropState,
  frame: CropFrame,
  source: Size,
  /** Keep the rectangle on the turned image. Off, it can reach past the edges. */
  onImage = true
): SourceCrop {
  'worklet';
  const rotation = normalizeDegrees(state.rotation);
  const { cos, sin } = trig(rotation);
  // Both platforms round the turned canvas down to whole pixels.
  const canvas = {
    width: Math.floor(Math.abs(source.width * cos) + Math.abs(source.height * sin) + 1e-6),
    height: Math.floor(Math.abs(source.width * sin) + Math.abs(source.height * cos) + 1e-6),
  };
  // Screen points per source pixel, at the current scale.
  const pointsPerPixel = (frame.image.width / source.width) * state.scale;
  const full = Math.max(1, Math.floor(frame.mask / pointsPerPixel));
  const side = onImage ? Math.max(1, Math.min(full, canvas.width, canvas.height)) : full;
  const centreX = canvas.width / 2 - state.x / pointsPerPixel;
  const centreY = canvas.height / 2 - state.y / pointsPerPixel;
  const originX = Math.round(centreX - side / 2);
  const originY = Math.round(centreY - side / 2);
  return {
    originX: onImage ? clamp(originX, 0, canvas.width - side) : originX,
    originY: onImage ? clamp(originY, 0, canvas.height - side) : originY,
    width: side,
    height: side,
    rotation,
    canvas,
  };
}

/** Superellipse exponent for the squircle. Four is soft; five reads as an app icon. */
const SQUIRCLE_EXPONENT = 5;
const SQUIRCLE_STEPS = 128;

/** The mask's outline as an SVG path, centred on (`cx`, `cy`). */
export function maskPath(shape: CropShape, cx: number, cy: number, mask: number): string {
  const r = mask / 2;
  if (shape === 'square') {
    return `M${cx - r} ${cy - r}H${cx + r}V${cy + r}H${cx - r}Z`;
  }
  if (shape === 'circle') {
    return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
  }
  const exponent = 2 / SQUIRCLE_EXPONENT;
  let path = '';
  for (let step = 0; step < SQUIRCLE_STEPS; step += 1) {
    const t = (step / SQUIRCLE_STEPS) * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const x = cx + r * Math.sign(cos) * Math.abs(cos) ** exponent;
    const y = cy + r * Math.sign(sin) * Math.abs(sin) ** exponent;
    path += `${step === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${path}Z`;
}
