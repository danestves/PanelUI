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
  for (const angle of ANGLES) close(minScale('circle', angle), 1);
  close(minScale('square', 0), 1);
  close(minScale('square', 90), 1);
  close(minScale('square', 45), Math.SQRT2);
  close(maskReach('squircle', 300, 45), 150 * Math.SQRT2);
});

test('settling keeps the whole mask on the photo, at any angle and any drag', () => {
  for (const shape of SHAPES) {
    for (const rotation of ANGLES) {
      for (const [x, y] of [[0, 0], [900, -40], [-500, 700], [30, 30]]) {
        for (const scale of [0.2, 1, 2.4, 40]) {
          const state = settle({ x, y, scale, rotation }, shape, FRAME, 5);
          assert.ok(state.scale >= minScale(shape, rotation) - 1e-9);
          assert.ok(state.scale <= Math.max(5, minScale(shape, rotation)) + 1e-9);
          assertCovers(state, shape);
        }
      }
    }
  }
});

test('a settled state is left alone', () => {
  const state = settle({ x: 40, y: -10, scale: 2, rotation: 12 }, 'circle', FRAME, 5);
  assert.deepEqual(settle(state, 'circle', FRAME, 5), state);
  const shown = present(state, 'circle', FRAME, 5);
  close(shown.x, state.x);
  close(shown.y, state.y);
  close(shown.scale, state.scale);
});

test('an overshoot gives, but less than it was pulled', () => {
  const pulled = { x: 2000, y: 0, scale: 1, rotation: 0 };
  const limit = clampTranslation(pulled, 'circle', FRAME).x;
  const shown = present(pulled, 'circle', FRAME, 5);
  assert.ok(shown.x > limit && shown.x < pulled.x);
  assert.ok(present({ ...pulled, x: 0, scale: 0.5 }, 'circle', FRAME, 5).scale > 0.5);
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
    const state = settle({ x: 35, y: -20, scale: 2.2, rotation }, 'circle', FRAME, 5);
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
