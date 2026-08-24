import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { plannerGridTarget } from '../src/components/planner/planner-grid-navigation.ts';

test('arrows move by a day or a rendered week', () => {
  assert.equal(plannerGridTarget('ArrowLeft', 15, 42), 14);
  assert.equal(plannerGridTarget('ArrowRight', 15, 42), 16);
  assert.equal(plannerGridTarget('ArrowUp', 15, 42), 8);
  assert.equal(plannerGridTarget('ArrowDown', 15, 42), 22);
});

test('Home and End use the rendered locale-aware week row', () => {
  assert.equal(plannerGridTarget('Home', 17, 42), 14);
  assert.equal(plannerGridTarget('End', 17, 42), 20);
  assert.equal(plannerGridTarget('Home', 0, 42), 0);
  assert.equal(plannerGridTarget('End', 41, 42), 41);
});

test('navigation is bounded instead of wrapping or changing month', () => {
  assert.equal(plannerGridTarget('ArrowLeft', 0, 42), 0);
  assert.equal(plannerGridTarget('ArrowUp', 6, 42), 6);
  assert.equal(plannerGridTarget('ArrowRight', 41, 42), 41);
  assert.equal(plannerGridTarget('ArrowDown', 35, 42), 35);
});

test('unrelated keys and invalid positions remain native Pressable concerns', () => {
  assert.equal(plannerGridTarget('Enter', 10, 42), null);
  assert.equal(plannerGridTarget(' ', 10, 42), null);
  assert.equal(plannerGridTarget('PageDown', 10, 42), null);
  assert.equal(plannerGridTarget('ArrowRight', -1, 42), null);
  assert.equal(plannerGridTarget('ArrowRight', 42, 42), null);
});

test('web roving props do not replace native and TV Pressable behavior', async () => {
  const source = await readFile(
    new URL('../src/components/planner/index.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /Platform\.OS === 'web'/);
  assert.match(source, /tabIndex: navigation\.activeIndex === gridIndex/);
  assert.match(source, /refs\.current\.get\(target\)\?\.focus\(\)/);
  assert.match(source, /<Pressable[\s\S]*?onPress=\{press\}/);
  assert.doesNotMatch(source, /PageUp|PageDown/);
});

test('movement steps over cells a look leaves blank', () => {
  // A month starting on a Thursday: the first three cells are last month's.
  const navigable = (index) => index >= 3;
  assert.equal(plannerGridTarget('ArrowLeft', 4, 42, 7, navigable), 3);
  assert.equal(plannerGridTarget('ArrowLeft', 3, 42, 7, navigable), 3);
  // Up from 9 lands on 2, which is blank, and the next step is off the grid.
  assert.equal(plannerGridTarget('ArrowUp', 9, 42, 7, navigable), 9);
  assert.equal(plannerGridTarget('ArrowUp', 10, 42, 7, navigable), 3);
});

test('Home and End walk inward when the edge of the row is blank', () => {
  const navigable = (index) => index >= 3;
  assert.equal(plannerGridTarget('Home', 5, 42, 7, navigable), 3);
  assert.equal(plannerGridTarget('End', 5, 42, 7, navigable), 6);
});

test('a row with nothing to move to leaves you where you were', () => {
  const only = (index) => index === 20;
  assert.equal(plannerGridTarget('ArrowRight', 20, 42, 7, only), 20);
  assert.equal(plannerGridTarget('ArrowDown', 20, 42, 7, only), 20);
  assert.equal(plannerGridTarget('Home', 20, 42, 7, only), 20);
  assert.equal(plannerGridTarget('End', 20, 42, 7, only), 20);
});

test('without a navigable predicate every cell still takes focus', () => {
  assert.equal(plannerGridTarget('ArrowLeft', 4, 42, 7), 3);
  assert.equal(plannerGridTarget('Home', 5, 42, 7), 0);
});
