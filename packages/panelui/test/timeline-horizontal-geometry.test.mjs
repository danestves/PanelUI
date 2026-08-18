import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  TIMELINE_NARROW_COLUMN,
  TIMELINE_WIDE_COLUMN,
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

test('consumer styles compose without replacing horizontal geometry or fade', async () => {
  const source = await readFile(
    new URL('../src/components/timeline/index.tsx', import.meta.url),
    'utf8'
  );
  const horizontal = source.slice(source.indexOf('<Animated.View', source.indexOf('TimelineItem')));

  assert.match(horizontal.slice(0, 350), /\.\.\.props[\s\S]*style=\{\[style, \{ width: columnWidth \}, columnStyle\]\}/);
});
