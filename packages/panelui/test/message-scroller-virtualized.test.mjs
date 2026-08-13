import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  initialMessageScrollerIndex,
  messageScrollerAnchorAt,
  messageScrollerIndex,
} from '../src/components/message-scroller/message-scroller-math.ts';

const turns = [
  { messageId: 'a', scrollAnchor: true },
  { messageId: 'b' },
  { messageId: 'c', scrollAnchor: true },
  { messageId: 'd' },
];

test('virtualized ids and initial positions address the complete data set', () => {
  assert.equal(messageScrollerIndex(turns, 'c'), 2);
  assert.equal(messageScrollerIndex(turns, 'missing'), undefined);
  assert.equal(initialMessageScrollerIndex(turns, 'start'), 0);
  assert.equal(initialMessageScrollerIndex(turns, 'last-anchor'), 2);
  assert.equal(initialMessageScrollerIndex(turns, 'end'), undefined);
  assert.equal(initialMessageScrollerIndex([], 'start'), undefined);
});

test('the current anchor survives mount-window changes', () => {
  assert.equal(messageScrollerAnchorAt(turns, 0), 'a');
  assert.equal(messageScrollerAnchorAt(turns, 1), 'a');
  assert.equal(messageScrollerAnchorAt(turns, 3), 'c');
  assert.equal(messageScrollerAnchorAt(turns, -1), null);
});

test('MessageScroller.List uses a bounded FlatList window and native prepend retention', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../src/components/message-scroller/index.tsx', import.meta.url)),
    'utf8'
  );
  assert.match(source, /<Animated\.FlatList/);
  assert.match(source, /initialNumToRender=\{initialNumToRender\}/);
  assert.match(source, /maxToRenderPerBatch=\{maxToRenderPerBatch\}/);
  assert.match(source, /windowSize=\{windowSize\}/);
  assert.match(source, /maintainVisibleContentPosition=/);
  assert.doesNotMatch(source, /data\.map\(/);
});

test('virtualized follow and id jumps route through the active list driver', () => {
  const source = fs.readFileSync(
    fileURLToPath(new URL('../src/components/message-scroller/index.tsx', import.meta.url)),
    'utf8'
  );
  assert.match(source, /if \(following\.current\) listRef\.current\?\.scrollToEnd/);
  assert.match(source, /messageScrollerIndex\(items\.current, id\)/);
  assert.match(source, /onScrollToIndexFailed=/);
});
