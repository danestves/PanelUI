import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  TIMELINE_WIDE_COLUMN,
  timelineColumnWidth,
} from '../src/components/timeline/timeline-geometry.ts';

const source = await readFile(
  new URL('../src/components/timeline/index.tsx', import.meta.url),
  'utf8'
);
const list = source.slice(source.indexOf('function TimelineList'), source.indexOf('export interface TimelineItemProps'));

test('Timeline.List uses a bounded native horizontal render window', () => {
  assert.match(list, /<Animated\.FlatList/);
  assert.match(list, /initialNumToRender = 6/);
  assert.match(list, /maxToRenderPerBatch = 6/);
  assert.match(list, /windowSize = 5/);
  assert.match(list, /removeClippedSubviews/);
  assert.doesNotMatch(list, /\{data\.map\(/);
});

test('Timeline.List owns exact variable-width layouts and item identity', () => {
  assert.match(list, /getItemLayout=\{\(_, index\) => \(\{/);
  assert.match(list, /length: widths\[index\] \?\? TIMELINE_WIDE_COLUMN/);
  assert.match(list, /offset: offsets\[index\] \?\? 0/);
  assert.match(list, /step: info\.index/);
  assert.match(list, /last: info\.index === data\.length - 1/);
  assert.match(list, /role: 'listitem'/);

  assert.equal(timelineColumnWidth(Number.NaN, true), TIMELINE_WIDE_COLUMN);
  assert.equal(timelineColumnWidth(-20, true), TIMELINE_WIDE_COLUMN);
  assert.equal(timelineColumnWidth(180, true), 180);
});

test('virtualized cells draw one rail segment without exposing decoration', () => {
  const item = source.slice(source.indexOf('const TimelineItem ='));
  assert.match(item, /virtualized && !last/);
  assert.match(item, /accessibilityElementsHidden/);
  assert.match(item, /importantForAccessibility="no-hide-descendants"/);
});
