import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { moveWithPinned, stepWithPinned } from '../src/components/sortable/reorder.ts';

const pinned = { pin: true, fixed: true };

test('gesture moves preserve every pinned slot in both directions', () => {
  const order = ['alpha', 'pin', 'bravo', 'fixed', 'charlie'];

  assert.deepEqual(moveWithPinned(order, order, pinned, 'alpha', 0, 4), [
    'bravo',
    'pin',
    'charlie',
    'fixed',
    'alpha',
  ]);
  assert.deepEqual(moveWithPinned(order, order, pinned, 'charlie', 4, 0), [
    'charlie',
    'pin',
    'alpha',
    'fixed',
    'bravo',
  ]);
});

test('gesture target at a pinned slot waits until the row crosses it', () => {
  const order = ['alpha', 'pin', 'bravo'];

  assert.deepEqual(moveWithPinned(order, order, pinned, 'alpha', 0, 1), order);
  assert.deepEqual(moveWithPinned(order, order, pinned, 'alpha', 0, 2), [
    'bravo',
    'pin',
    'alpha',
  ]);
});

test('accessibility steps cross adjacent pinned slots without moving them', () => {
  const order = ['alpha', 'pin', 'bravo', 'fixed', 'charlie'];
  const gestureDown = moveWithPinned(order, order, pinned, 'alpha', 0, 2);
  const gestureUp = moveWithPinned(order, order, pinned, 'charlie', 4, 2);

  assert.deepEqual(stepWithPinned(order, order, pinned, 'alpha', 0, 1), gestureDown);
  assert.deepEqual(stepWithPinned(order, order, pinned, 'charlie', 4, -1), gestureUp);
});

test('boundaries and pinned rows remain no-ops', () => {
  const order = ['alpha', 'pin', 'bravo'];

  assert.deepEqual(stepWithPinned(order, order, pinned, 'alpha', 0, -1), order);
  assert.deepEqual(stepWithPinned(order, order, pinned, 'pin', 1, 1), order);
});

test('the copied-source registry ships the canonical reorder helper', () => {
  const registry = JSON.parse(
    readFileSync(new URL('../../../apps/docs/public/r/sortable.json', import.meta.url), 'utf8')
  );
  const files = new Map(registry.files.map((file) => [file.path, file.content]));
  const source = readFileSync(
    new URL('../src/components/sortable/reorder.ts', import.meta.url),
    'utf8'
  );

  assert.equal(files.get('ui/reorder.ts'), source);
  assert.match(files.get('ui/sortable.tsx'), /from '@\/components\/ui\/reorder'/);
});
