import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  isCollapsed,
  layoutOffset,
  normalizeConstraint,
  resizeLayout,
  resolveLayout,
} from '../src/components/splitter/splitter-math.ts';

const open = (overrides) => normalizeConstraint({ ...overrides });
const total = (layout) => layout.reduce((sum, size) => sum + size, 0);

test('limits are filled in an order that cannot contradict itself', () => {
  assert.deepEqual(normalizeConstraint(undefined), {
    minSize: 10,
    maxSize: 100,
    collapsible: false,
    collapsedSize: 0,
  });

  // A maximum below the minimum is pulled up to it rather than inverting the range.
  assert.equal(normalizeConstraint({ minSize: 40, maxSize: 20 }).maxSize, 40);
  // A collapsed size above the minimum it sits below is pulled down to it.
  assert.equal(
    normalizeConstraint({ minSize: 15, collapsible: true, collapsedSize: 90 }).collapsedSize,
    15
  );
  assert.equal(normalizeConstraint({ minSize: -20 }).minSize, 0);
  assert.equal(normalizeConstraint({ minSize: Number.NaN }).minSize, 10);
  assert.equal(normalizeConstraint({ maxSize: 400 }).maxSize, 100);
});

test('unsized panes split what the sized ones left over', () => {
  const constraints = [open(), open(), open()];
  assert.deepEqual(resolveLayout([50, undefined, undefined], constraints), [50, 25, 25]);
  assert.deepEqual(resolveLayout([undefined, undefined], [open(), open()]), [50, 50]);
});

test('a resolved layout always adds up to the whole', () => {
  const cases = [
    [[10, 10], [open(), open()]],
    [[90, 90], [open(), open()]],
    [[undefined, undefined, undefined], [open(), open(), open()]],
    [[70, undefined], [open({ maxSize: 40 }), open()]],
    [[5, 5], [open({ minSize: 30 }), open({ minSize: 30 })]],
  ];
  for (const [sizes, constraints] of cases) {
    assert.ok(Math.abs(total(resolveLayout(sizes, constraints)) - 100) < 1e-6);
  }
  assert.deepEqual(resolveLayout([], []), []);
});

test('minimums that cannot all fit shrink together instead of overflowing', () => {
  const layout = resolveLayout(
    [undefined, undefined, undefined],
    [open({ minSize: 50 }), open({ minSize: 50 }), open({ minSize: 50 })]
  );
  assert.ok(Math.abs(total(layout) - 100) < 1e-6);
  assert.deepEqual(
    layout.map((size) => Math.round(size)),
    [33, 33, 33]
  );
});

test('a drag borrows from its neighbour and from nobody else', () => {
  const constraints = [open(), open(), open()];
  const next = resizeLayout([40, 30, 30], 0, 10, constraints);
  assert.deepEqual(next, [50, 20, 30]);
  assert.ok(Math.abs(total(next) - 100) < 1e-6);
});

test('a seam stops at whichever limit it reaches first', () => {
  // The growing pane's own maximum.
  assert.deepEqual(resizeLayout([40, 60], 0, 40, [open({ maxSize: 55 }), open()]), [55, 45]);
  // The shrinking neighbour's minimum.
  assert.deepEqual(resizeLayout([40, 60], 0, 40, [open(), open({ minSize: 30 })]), [70, 30]);
  // And in the other direction, the dragged pane's own minimum.
  assert.deepEqual(resizeLayout([40, 60], 0, -40, [open({ minSize: 25 }), open()]), [25, 75]);
});

test('a seam with nothing on the far side of it does not move', () => {
  const layout = [50, 50];
  assert.deepEqual(resizeLayout(layout, 1, 10, [open(), open()]), layout);
  assert.deepEqual(resizeLayout(layout, -1, 10, [open(), open()]), layout);
  assert.deepEqual(resizeLayout(layout, 0, Number.NaN, [open(), open()]), layout);
  assert.notEqual(resizeLayout(layout, 0, 5, [open(), open()]), layout);
});

test('collapsing waits until the drag is more than halfway there', () => {
  const collapsible = [open({ minSize: 20, collapsible: true }), open()];

  // Short of halfway between shut and the minimum: held at the minimum.
  assert.deepEqual(resizeLayout([40, 60], 0, -25, collapsible), [20, 80]);
  // Past it: shut.
  assert.deepEqual(resizeLayout([40, 60], 0, -35, collapsible), [0, 100]);
  // And a pane that cannot collapse stops at its minimum however far the drag went.
  assert.deepEqual(resizeLayout([40, 60], 0, -400, [open({ minSize: 20 }), open()]), [20, 80]);
});

test('only the pane being shrunk is ever offered the collapse', () => {
  const both = [
    open({ minSize: 20, collapsible: true }),
    open({ minSize: 20, collapsible: true }),
  ];
  // Growing the first pane past everything shuts the second, never the first.
  assert.deepEqual(resizeLayout([50, 50], 0, 60, both), [100, 0]);
  assert.deepEqual(resizeLayout([50, 50], 0, -60, both), [0, 100]);
});

test('a shut pane reads as shut, and a small one does not', () => {
  const constraint = open({ minSize: 20, collapsible: true, collapsedSize: 4 });
  assert.equal(isCollapsed(4, constraint), true);
  assert.equal(isCollapsed(4.0000001, constraint), true);
  assert.equal(isCollapsed(19, constraint), false);
  assert.equal(isCollapsed(0, open({ minSize: 20 })), false);
});

test('a seam sits at the sum of everything before it', () => {
  assert.equal(layoutOffset([30, 20, 50], 0), 30);
  assert.equal(layoutOffset([30, 20, 50], 1), 50);
  assert.equal(layoutOffset([30, 20, 50], -1), 0);
  assert.equal(layoutOffset([30, 20, 50], 9), 100);
});

test('the copied Splitter ships the layout arithmetic', async () => {
  const item = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/splitter.json', import.meta.url),
      'utf8'
    )
  );
  assert.ok(item.files.some((file) => file.path === 'ui/splitter-math.ts'));
  assert.match(
    item.files.find((file) => file.path === 'ui/splitter.tsx').content,
    /resizeLayout\(start\.value, boundary, delta, constraints\)/
  );
});
