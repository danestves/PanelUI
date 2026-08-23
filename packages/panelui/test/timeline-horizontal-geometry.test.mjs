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

/**
 * The contract is the *order* of the style array, not how it is formatted.
 *
 * A consumer's `style` goes first so it can add to the column; the measured
 * width and the reserved rail band go after it so a consumer cannot drop
 * either by accident; and the scroll-driven fade goes last so nothing can
 * freeze it. Written as one line or as five, that order is what has to hold.
 */
test('consumer styles compose without replacing horizontal geometry or fade', async () => {
  const source = await readFile(
    new URL('../src/components/timeline/index.tsx', import.meta.url),
    'utf8'
  );
  const item = source.slice(source.indexOf('<Animated.View', source.indexOf('TimelineItem')));
  const array = item.slice(item.indexOf('style={['), item.indexOf('>', item.indexOf('style={[')));

  const order = ['style,', 'width: columnWidth', 'paddingTop: HORIZONTAL_RAIL_TOP', 'columnStyle'];
  let cursor = -1;
  for (const token of order) {
    const at = array.indexOf(token, cursor + 1);
    assert.ok(at > cursor, `expected ${token} after the previous entry in the item's style array`);
    cursor = at;
  }
});

/**
 * The rail band belongs to the column, not to whatever it happens to contain.
 *
 * Reserved by `Timeline.Aside` instead — which is how it used to work — a
 * column written without one puts its tick at the top of the column and a
 * whole band above the rail, and the rail stops being a line.
 */
test('the band above the rail is reserved by the column, and the aside draws into it', async () => {
  const source = await readFile(
    new URL('../src/components/timeline/index.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /paddingTop: HORIZONTAL_RAIL_TOP/);
  assert.match(
    source,
    /\{ height: HORIZONTAL_RAIL_TOP, marginTop: -HORIZONTAL_RAIL_TOP \}/,
    'Timeline.Aside must cancel its own height so a column without one still lines up'
  );
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
