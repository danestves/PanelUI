import assert from 'node:assert/strict';
import test from 'node:test';

import { reconcileMarkedTag } from '../src/components/tag-input/tag-input-state.ts';

test('a tag mark survives while the same tag still owns its slot', () => {
  const marked = { index: 1, tag: 'research' };

  assert.equal(reconcileMarkedTag(marked, ['design', 'research']), marked);
});

test('a controlled replacement cannot inherit an armed deletion', () => {
  const marked = { index: 1, tag: 'research' };

  assert.equal(reconcileMarkedTag(marked, ['design', 'operations']), null);
});

test('a controlled reorder clears the old positional mark', () => {
  const marked = { index: 1, tag: 'research' };

  assert.equal(reconcileMarkedTag(marked, ['research', 'design']), null);
});

test('removing the marked slot clears its deletion state', () => {
  const marked = { index: 1, tag: 'research' };

  assert.equal(reconcileMarkedTag(marked, ['design']), null);
});

test('TagInput reconciles the mark on value changes and before removal', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) =>
    readFile(
      new URL('../src/components/tag-input/index.tsx', import.meta.url),
      'utf8'
    )
  );

  assert.match(
    source,
    /setMarked\(\(current\) => reconcileMarkedTag\(current, tags\)\)/
  );
  assert.match(
    source,
    /marked !== null && reconcileMarkedTag\(marked, tags\)[\s\S]*removeAt\(marked\.index\)/
  );
});
