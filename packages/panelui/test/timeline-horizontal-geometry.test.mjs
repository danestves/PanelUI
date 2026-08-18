import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  TIMELINE_NARROW_COLUMN,
  TIMELINE_WIDE_COLUMN,
  timelineColumnOffsets,
  timelineColumnWidth,
} from '../src/components/timeline/timeline-geometry.ts';

test('horizontal Timeline widths accept positive finite overrides only', () => {
  assert.equal(timelineColumnWidth(144, true), 144);
  assert.equal(timelineColumnWidth(32.5, false), 32.5);

  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(timelineColumnWidth(invalid, true), TIMELINE_WIDE_COLUMN);
    assert.equal(timelineColumnWidth(invalid, false), TIMELINE_NARROW_COLUMN);
  }
});

test('horizontal offsets follow rendered columns rather than semantic step numbers', () => {
  assert.deepEqual(timelineColumnOffsets([100, 40, 75]), [0, 100, 140]);
  assert.deepEqual(timelineColumnOffsets([]), []);
});

test('consumer styles compose without replacing horizontal geometry or fade', async () => {
  const source = await readFile(
    new URL('../src/components/timeline/index.tsx', import.meta.url),
    'utf8'
  );
  const horizontal = source.slice(source.indexOf('<Animated.View', source.indexOf('TimelineItem')));

  assert.match(horizontal.slice(0, 350), /\.\.\.props[\s\S]*style=\{\[style, \{ width: columnWidth \}, columnStyle\]\}/);
});

test('only real Timeline items own snap offsets and each receives its rendered offset', async () => {
  const source = await readFile(
    new URL('../src/components/timeline/index.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /child\.type === TimelineItem/);
  assert.match(source, /timelineColumnOffsets\(items\.map\(\(item\) => itemWidth\(item\.props\)\)\)/);
  assert.match(source, /TimelineColumnOffsetContext\.Provider value=\{offset\}/);
  assert.match(source, /const offset = columnOffset \?\? 0/);
  assert.doesNotMatch(source, /offsets\[step\]/);
});
