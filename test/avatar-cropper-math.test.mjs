/**
 * The avatar cropper's promise is that the image you get back is the one you
 * framed, and that the frame never shows anything but photo.
 *
 * Both are properties of the arithmetic rather than of the drawing, so they are
 * checked here. Clamping has to keep every point of the mask on the photo at
 * any angle, and the export rectangle has to land on the same pixels the mask
 * showed — after the source has been turned, which is the step that is easy to
 * get wrong by a sign and impossible to notice until a crop comes back shifted.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  baseSize,
  clampTranslation,
  coversMask,
  maskReach,
  minScale,
  nextQuarterTurn,
  normalizeDegrees,
  present,
  rotateAbout,
  settle,
  sourceCrop,
  zoomAbout,
} from '../packages/panelui/src/components/avatar-cropper/avatar-cropper-math.ts';

const SHAPES = ['circle', 'squircle', 'square'];
/** The default bounds for a shape: covering, up to 5×. */
const cover = (shape) => ({ shape, maxZoom: 5, cover: true, minZoom: 0.5 });
/** The same shape with `cover` off. */
const loose = (shape) => ({ shape, maxZoom: 5, cover: false, minZoom: 0.5 });
const ANGLES = [0, 37, 90, -135, 200];
const close = (actual, expected, epsilon = 1e-6, message) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, message ?? `${actual} ≉ ${expected}`);

/** A 4000×3000 photo under a 300pt mask. */
const SOURCE = { width: 4000, height: 3000 };
const MASK = 300;
const FRAME = { mask: MASK, image: baseSize(SOURCE, MASK) };

/** Where a screen point (relative to the canvas centre) falls in the photo, in base points. */
function toPhoto(state, px, py) {
  const radians = (-state.rotation * Math.PI) / 180;
  const dx = px - state.x;
  const dy = py - state.y;
  return {
    u: (Math.cos(radians) * dx - Math.sin(radians) * dy) / state.scale,
    v: (Math.sin(radians) * dx + Math.cos(radians) * dy) / state.scale,
  };
}

/** Points around the mask's outline, for the coverage check. */
function outline(shape) {
  const r = MASK / 2;
  if (shape === 'circle') {
    return Array.from({ length: 64 }, (_, i) => {
      const t = (i / 64) * Math.PI * 2;
      return [r * Math.cos(t), r * Math.sin(t)];
    });
  }
  return [[-r, -r], [r, -r], [r, r], [-r, r]];
}

function assertCovers(state, shape) {
  for (const [px, py] of outline(shape)) {
    const { u, v } = toPhoto(state, px, py);
    assert.ok(
      Math.abs(u) <= FRAME.image.width / 2 + 1e-6 && Math.abs(v) <= FRAME.image.height / 2 + 1e-6,
      `${shape} at ${state.rotation}° leaves the photo at (${px}, ${py})`,
    );
  }
}

test('the base size covers the mask with its short side', () => {
  assert.deepEqual(baseSize({ width: 4000, height: 3000 }, 300), { width: 400, height: 300 });
  assert.deepEqual(baseSize({ width: 1000, height: 2000 }, 300), { width: 300, height: 600 });
});

test('a circle needs no extra zoom to turn; a square needs its diagonal', () => {
  for (const angle of ANGLES) close(minScale(cover('circle'), FRAME, angle), 1);
  close(minScale(cover('square'), FRAME, 0), 1);
  close(minScale(cover('square'), FRAME, 90), 1);
  close(minScale(cover('square'), FRAME, 45), Math.SQRT2);
  close(maskReach('squircle', 300, 45), 150 * Math.SQRT2);
});

test('settling keeps the whole mask on the photo, at any angle and any drag', () => {
  for (const shape of SHAPES) {
    for (const rotation of ANGLES) {
      for (const [x, y] of [[0, 0], [900, -40], [-500, 700], [30, 30]]) {
        for (const scale of [0.2, 1, 2.4, 40]) {
          const state = settle({ x, y, scale, rotation }, cover(shape), FRAME);
          const lowest = minScale(cover(shape), FRAME, rotation);
          assert.ok(state.scale >= lowest - 1e-9);
          assert.ok(state.scale <= Math.max(5, lowest) + 1e-9);
          assertCovers(state, shape);
          assert.ok(coversMask(state, shape, FRAME));
        }
      }
    }
  }
});

test('a settled state is left alone', () => {
  const state = settle({ x: 40, y: -10, scale: 2, rotation: 12 }, cover('circle'), FRAME);
  assert.deepEqual(settle(state, cover('circle'), FRAME), state);
  const shown = present(state, cover('circle'), FRAME);
  close(shown.x, state.x);
  close(shown.y, state.y);
  close(shown.scale, state.scale);
});

test('an overshoot gives, but less than it was pulled', () => {
  const pulled = { x: 2000, y: 0, scale: 1, rotation: 0 };
  const limit = clampTranslation(pulled, cover('circle'), FRAME).x;
  const shown = present(pulled, cover('circle'), FRAME);
  assert.ok(shown.x > limit && shown.x < pulled.x);
  assert.ok(present({ ...pulled, x: 0, scale: 0.5 }, cover('circle'), FRAME).scale > 0.5);
});

test('zooming and turning about a point keep that point fixed', () => {
  const start = { x: 20, y: -30, scale: 1.5, rotation: 10 };
  const before = toPhoto(start, 60, 80);
  const zoomed = toPhoto(zoomAbout(start, 1.7, 60, 80), 60, 80);
  close(zoomed.u, before.u);
  close(zoomed.v, before.v);
  const turned = toPhoto(rotateAbout(start, 33, 60, 80), 60, 80);
  close(turned.u, before.u);
  close(turned.v, before.v);
});

test('a quarter turn steps from a quarter, and finishes a part-turn', () => {
  assert.equal(nextQuarterTurn(0, 1), 90);
  assert.equal(nextQuarterTurn(90, -1), 0);
  assert.equal(nextQuarterTurn(30, 1), 90);
  assert.equal(nextQuarterTurn(30, -1), 0);
  assert.equal(nextQuarterTurn(-30, 1), 0);
  assert.equal(normalizeDegrees(270), -90);
  assert.equal(normalizeDegrees(-180), 180);
});

test('the export cuts the pixels the mask showed', () => {
  // Unturned, centred, scale 1: the mask is the middle 3000×3000 of the photo.
  assert.deepEqual(sourceCrop({ x: 0, y: 0, scale: 1, rotation: 0 }, FRAME, SOURCE), {
    originX: 500, originY: 0, width: 3000, height: 3000, rotation: 0,
    canvas: { width: 4000, height: 3000 },
  });

  // Zoomed 2× and moved 50pt right: 10 px per pt at scale 1, so 5 at scale 2;
  // the mask is 1500 px across and its centre 250 px left of the photo's.
  assert.deepEqual(sourceCrop({ x: 50, y: 0, scale: 2, rotation: 0 }, FRAME, SOURCE), {
    originX: 1000, originY: 750, width: 1500, height: 1500, rotation: 0,
    canvas: { width: 4000, height: 3000 },
  });

  // A quarter turn clockwise: the canvas becomes 3000×4000, and the photo's
  // left edge is now its top. Moved 50pt right on screen after the turn.
  const quarter = sourceCrop({ x: 50, y: 0, scale: 2, rotation: 90 }, FRAME, SOURCE);
  assert.deepEqual(quarter.canvas, { width: 3000, height: 4000 });
  assert.deepEqual(
    [quarter.originX, quarter.originY, quarter.width],
    [3000 / 2 - 250 - 750, 4000 / 2 - 750, 1500],
  );
});

test('the export at a free angle matches the mask, measured independently', () => {
  for (const rotation of [37, -120]) {
    const state = settle({ x: 35, y: -20, scale: 2.2, rotation }, cover('circle'), FRAME);
    const crop = sourceCrop(state, FRAME, SOURCE);
    // Independently: where the mask's centre is in the source, in pixels from
    // its centre, then turned by the same angle into the bigger canvas.
    const pixelsPerPoint = SOURCE.width / FRAME.image.width;
    const centre = toPhoto(state, 0, 0);
    const radians = (rotation * Math.PI) / 180;
    const px = centre.u * pixelsPerPoint;
    const py = centre.v * pixelsPerPoint;
    const cx = crop.canvas.width / 2 + Math.cos(radians) * px - Math.sin(radians) * py;
    const cy = crop.canvas.height / 2 + Math.sin(radians) * px + Math.cos(radians) * py;
    close(crop.originX + crop.width / 2, cx, 1, `x centre at ${rotation}°`);
    close(crop.originY + crop.height / 2, cy, 1, `y centre at ${rotation}°`);
    close(crop.width, MASK * pixelsPerPoint / state.scale, 1);
  }
});

test('with cover off, the photo zooms out until its long side is minZoom of the outline', () => {
  // The base photo is 400×300 against a 300 mask, so its long side is 400.
  close(minScale(loose('circle'), FRAME, 0), (0.5 * MASK) / 400);
  const out = settle({ x: 0, y: 0, scale: 0.01, rotation: 0 }, loose('circle'), FRAME);
  close(out.scale, (0.5 * MASK) / 400);
  assert.equal(coversMask(out, 'circle', FRAME), false);
  // Zoomed in past covering, it behaves exactly as with cover on.
  const zoomed = { x: 120, y: -400, scale: 2, rotation: 25 };
  assert.deepEqual(settle(zoomed, loose('square'), FRAME), settle(zoomed, cover('square'), FRAME));
});

test('a photo smaller than the outline stays inside it', () => {
  const small = settle({ x: 900, y: -900, scale: 0.5, rotation: 0 }, loose('circle'), FRAME);
  // 400×300 at half size is 200×150; the mask reaches 150 each way.
  close(Math.abs(small.x), 150 - 100);
  close(Math.abs(small.y), 150 - 75);
});

test('the export of a photo smaller than the outline reaches past its edges', () => {
  const state = { x: 0, y: 0, scale: 0.5, rotation: 0 };
  const crop = sourceCrop(state, FRAME, SOURCE, false);
  // 10 px per pt at scale 1, so 20 at 0.5: a 300pt mask is 6000 px, centred
  // on a 4000×3000 photo.
  assert.deepEqual([crop.originX, crop.originY, crop.width], [-1000, -1500, 6000]);
  // Kept on the image, the same state is cut down to fit.
  assert.equal(sourceCrop(state, FRAME, SOURCE).width, 3000);
});
