/**
 * The field has to fill the box it is given.
 *
 * The first version measured itself in normal layout flow, where a grid of
 * drawings has no intrinsic height — so it measured to nothing and drew a
 * single row of dots along the top of the frame. These pin the arithmetic that
 * would have caught it.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  BANDS,
  bandOpacity,
  centreAt,
  influenceAt,
  renderField,
} from '../src/components/image-generation/dot-field.ts';

/** How many circles a band's path holds. Each one opens with `M`. */
const count = (d) => (d.match(/M/g) ?? []).length;

test('the field covers the whole box, not one row of it', () => {
  const bands = renderField(208, 208, 0);
  const dots = bands.reduce((total, d) => total + count(d), 0);
  // A 208pt square at a 10pt gap is 22 columns by 22 rows.
  assert.ok(dots > 400, `expected a full grid, drew ${dots} dots`);
});

test('a wide box gets a wide grid', () => {
  const wide = renderField(320, 180, 0);
  const tall = renderField(180, 320, 0);
  const dotsOf = (bands) => bands.reduce((total, d) => total + count(d), 0);
  // Same area, so the same order of dots — the grid follows the box rather
  // than assuming a square.
  assert.ok(Math.abs(dotsOf(wide) - dotsOf(tall)) < 10);
});

test('an unmeasured box draws nothing rather than dividing by zero', () => {
  for (const bands of [renderField(0, 0, 0), renderField(200, 0, 0), renderField(0, 200, 0)]) {
    assert.equal(bands.length, BANDS);
    assert.deepEqual(bands, Array.from({ length: BANDS }, () => ''));
  }
});

test('a very large box is drawn coarser rather than with more dots', () => {
  const dots = renderField(1200, 1200, 0).reduce((total, d) => total + count(d), 0);
  // Otherwise a full-width field on a tablet is thousands of circles rebuilt
  // every frame, which is a placeholder costing more than the screen it is on.
  assert.ok(dots <= 1000, `drew ${dots} dots`);
  assert.ok(dots > 500, `drew ${dots} dots — too coarse to read as a field`);
});

test('the light is somewhere different at different moments', () => {
  const [x0, y0] = centreAt(0, 200, 200);
  const [x1, y1] = centreAt(900, 200, 200);
  assert.notEqual(x0, x1);
  assert.notEqual(y0, y1);
  // It drifts around the middle rather than touring the box: a light that
  // reaches a corner stops reading as one source.
  for (const time of [0, 400, 900, 1700, 2100, 5000]) {
    const [x, y] = centreAt(time, 200, 200);
    assert.ok(x > 60 && x < 140, `x drifted to ${x}`);
    assert.ok(y > 60 && y < 140, `y drifted to ${y}`);
  }
});

test('the light has no edge', () => {
  // Smoothstep: it arrives and leaves at zero slope, so there is no rim where
  // the eye can find the boundary.
  assert.equal(influenceAt(0, 100), 1);
  assert.equal(influenceAt(100, 100), 0);
  assert.equal(influenceAt(200, 100), 0);
  const near = influenceAt(5, 100) - influenceAt(0, 100);
  const mid = influenceAt(55, 100) - influenceAt(50, 100);
  assert.ok(Math.abs(near) < Math.abs(mid), 'the ramp should be flat at the centre');
});

test('every band has an opacity, and brighter bands are brighter', () => {
  const levels = Array.from({ length: BANDS }, (_unused, band) => bandOpacity(band));
  for (let i = 1; i < levels.length; i += 1) {
    assert.ok(levels[i] > levels[i - 1], 'bands must ramp upward');
  }
  assert.ok(levels[0] > 0 && levels[BANDS - 1] <= 1);
});

test('the field is drawn to fill rather than measured in flow', async () => {
  const source = await readFile(
    new URL('../src/components/image-generation/index.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /style=\{\[StyleSheet\.absoluteFill, style\]\}/);
  // Held and reduced-motion fields still draw a frame. Without this the box is
  // simply empty, which is indistinguishable from a component that failed.
  assert.match(source, /paths\.value = renderField\(size\.width, size\.height, clock\.value \|\| STILL_FRAME\)/);
});
