import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  canEnterSelection,
  handleSelectionItemPress,
  selectAllValues,
  selectionOwnsPress,
  selectionTarget,
  selectValue,
  toggleValue,
} from '../src/components/selection-mode/selection-mode-contracts.ts';

test('max zero permits neither entry selection nor toggling on', () => {
  assert.deepEqual(selectValue([], 'alpha', 0), []);
  assert.deepEqual(toggleValue([], 'alpha', 0), []);
  assert.deepEqual(toggleValue(['alpha'], 'alpha', 0), []);
  assert.deepEqual(selectAllValues(['alpha', 'beta'], 0), []);
  assert.equal(selectionTarget(2, 0), 0);
});

test('entry and toggle additions stop at the same max boundary', () => {
  const current = ['alpha'];

  assert.strictEqual(selectValue(current, 'beta', 1), current);
  assert.strictEqual(toggleValue(current, 'beta', 1), current);
  assert.deepEqual(toggleValue(current, 'alpha', 1), []);
  assert.deepEqual(toggleValue([], 'beta', 1), ['beta']);
  assert.deepEqual(selectAllValues(['alpha', 'beta'], 1), ['alpha']);
});

test('inactive nonselectable rows keep their ordinary action', () => {
  let actions = 0;
  let toggles = 0;

  handleSelectionItemPress(false, true, () => toggles++, () => actions++);

  assert.equal(actions, 1);
  assert.equal(toggles, 0);
  assert.equal(selectionOwnsPress(false, true), false);
  assert.equal(canEnterSelection(false, true, false), false);
});

test('active selection owns only eligible row presses', () => {
  let actions = 0;
  let toggles = 0;

  handleSelectionItemPress(true, false, () => toggles++, () => actions++);
  handleSelectionItemPress(true, true, () => toggles++, () => actions++);

  assert.equal(actions, 1);
  assert.equal(toggles, 1);
  assert.equal(selectionOwnsPress(true, false), true);
  assert.equal(selectionOwnsPress(true, true), false);
  assert.equal(canEnterSelection(true, false, false), false);
});

test('eligible screen rows can enter while sheet and disabled rows cannot', () => {
  assert.equal(canEnterSelection(false, false, false), true);
  assert.equal(canEnterSelection(false, false, true), false);
  assert.equal(canEnterSelection(false, true, false), false);
});

test('the copied-source registry ships the canonical selection contracts', () => {
  const registry = JSON.parse(
    readFileSync(new URL('../../../apps/docs/public/r/selection-mode.json', import.meta.url), 'utf8')
  );
  const files = new Map(registry.files.map((file) => [file.path, file.content]));
  const source = readFileSync(
    new URL('../src/components/selection-mode/selection-mode-contracts.ts', import.meta.url),
    'utf8'
  );

  assert.equal(files.get('ui/selection-mode-contracts.ts'), source);
  assert.match(
    files.get('ui/selection-mode.tsx'),
    /from '@\/components\/ui\/selection-mode-contracts'/
  );
});
