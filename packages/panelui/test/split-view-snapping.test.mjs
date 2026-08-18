import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DEFAULT_MIN_HEIGHT,
  nearestSnapIndex,
  normalizeSnapIndex,
  resolveLength,
  resolveSnapPoints,
} from '../src/components/split-view/split-view-math.ts';

test('a length is a fraction below one and points above it', () => {
  assert.equal(resolveLength(0.5, 400, 0), 200);
  assert.equal(resolveLength(1, 400, 0), 400);
  // Above one is already points, and is not scaled a second time.
  assert.equal(resolveLength(120, 400, 0), 120);
  // Negative is measured back from the far edge.
  assert.equal(resolveLength(-80, 400, 0), 320);
  // Anything that is not a number at all falls back rather than producing NaN.
  for (const bad of [undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(resolveLength(bad, 400, DEFAULT_MIN_HEIGHT), DEFAULT_MIN_HEIGHT);
  }
});

test('snap points are clamped into the range the panes allow, and sorted', () => {
  // 0.05 of 400 is 20, below the 100 floor, so it is pulled up rather than dropped.
  assert.deepEqual(resolveSnapPoints([0.8, 0.05, 0.5], 400, 100, 400), [100, 200, 320]);

  // A maximum pulls the tall ones down the same way.
  assert.deepEqual(resolveSnapPoints([0.5, 0.9], 400, 100, 300), [200, 300]);
});

test('two points that land on the same height become one', () => {
  // Both clamp to the floor, and a list with the same height twice makes a
  // flick settle on a snap that looks like it did nothing.
  assert.deepEqual(resolveSnapPoints([0.05, 0.1], 400, 100, 400), [100]);
});

test('a list with nothing usable in it still yields somewhere to sit', () => {
  assert.deepEqual(resolveSnapPoints([Number.NaN], 400, 100, 400), [100]);
  // The defaults are a fifth, a half and four fifths — and the fifth is below
  // the floor here, so it is pulled up to it like any other point would be.
  assert.deepEqual(resolveSnapPoints([], 400, 100, 400), [100, 200, 320]);
});

test('a release lands on the nearest point to where the throw was going', () => {
  const points = [100, 200, 300];

  // At rest, the nearest point wins outright.
  assert.equal(nearestSnapIndex(210, points, 0, 400), 1);
  assert.equal(nearestSnapIndex(260, points, 0, 400), 2);

  // A flick downward carries past a midpoint the finger never crossed.
  assert.equal(nearestSnapIndex(210, points, 900, 400), 2);
  assert.equal(nearestSnapIndex(190, points, -900, 400), 0);

  // But it cannot skip the list, however hard it is thrown: the result is held
  // to one point either side of where the pane actually is.
  assert.equal(nearestSnapIndex(100, points, 100000, 400), 1);
  assert.equal(nearestSnapIndex(300, points, -100000, 400), 1);

  // Which has to hold for a list packed close together as well as a wide one —
  // capping the distance alone would skip two of these.
  assert.equal(nearestSnapIndex(100, [100, 110, 120, 130], 100000, 400), 1);
});

test('a starting index is kept inside the list that exists', () => {
  assert.equal(normalizeSnapIndex(5, 3), 2);
  assert.equal(normalizeSnapIndex(-1, 3), 0);
  assert.equal(normalizeSnapIndex(1.6, 3), 2);
  assert.equal(normalizeSnapIndex(undefined, 3), 0);
  assert.equal(normalizeSnapIndex(1, 0), 0);
});

test('the copied SplitView ships the snapping arithmetic', async () => {
  const item = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/split-view.json', import.meta.url),
      'utf8'
    )
  );
  assert.ok(item.files.some((file) => file.path === 'ui/split-view-math.ts'));

  const copied = item.files.find((file) => file.path === 'ui/split-view.tsx').content;
  // The drag area's own height comes out before the fractions are resolved, so
  // half means half of what is actually divisible.
  assert.match(copied, /const room = Math\.max\(container - dragAreaHeight, 0\)/);
  assert.match(copied, /nearestSnapIndex\(/);
});
