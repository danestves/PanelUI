import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/components/timeline/index.tsx', import.meta.url),
  'utf8'
);

test('a horizontal column is focused, not merely faded', () => {
  const column = source.slice(source.indexOf('const columnStyle = useAnimatedStyle'));

  // One column's width either side. Two kept three columns near full strength,
  // which is a row with nothing picked out.
  assert.match(column.slice(0, 500), /timelineColumnWidth\(undefined, true\), 1\);/);
  assert.doesNotMatch(column.slice(0, 500), /, 1\) \* 2;/);

  // Depth, so the column at the edge is not flat against the rest.
  assert.match(column.slice(0, 500), /scale: 1 - away \* 0\.04/);
  assert.match(column.slice(0, 500), /translateY: away \* 4/);
});

test('the body recedes further than the rail it hangs under', () => {
  const body = source.slice(source.indexOf('const bodyStyle = useAnimatedStyle'));
  assert.match(body.slice(0, 400), /\[1, 0\.3\], 'clamp'/);

  // Both curves are dropped under reduce motion rather than only one.
  assert.match(body.slice(0, 400), /if \(!horizontal \|\| !animate\) return \{ opacity: 1 \}/);
});

test('a column hands its geometry down instead of being measured twice', () => {
  assert.match(source, /showSeparator: !last,\s*\n\s*offset,\s*\n\s*columnWidth: columnWidth \?\? 0,/);
  assert.match(source, /const \{ completed, tone, offset, columnWidth \} =/);
});
