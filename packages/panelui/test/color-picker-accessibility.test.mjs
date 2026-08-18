import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { enabledColorPickerAction } from '../src/components/color-picker/color-picker-accessibility.ts';

test('disabled color picker controls reject accessibility actions', () => {
  assert.equal(enabledColorPickerAction('increment', true), undefined);
  assert.equal(enabledColorPickerAction('brighter', true), undefined);
});

test('enabled color picker controls preserve accessibility actions', () => {
  assert.equal(enabledColorPickerAction('increment', false), 'increment');
  assert.equal(enabledColorPickerAction('saturate', false), 'saturate');
});

function assertDisabledActionContract(source) {
  assert.match(
    source,
    /enabledColorPickerAction\(\s*event\.nativeEvent\.actionName,\s*ctx\.disabled\s*\)/
  );
  assert.equal(
    source.match(/enabledColorPickerAction\(/g)?.length,
    5,
    'all five adjustable surfaces must enforce the shared disabled boundary'
  );
}

test('every color picker adjustable surface enforces the disabled boundary', async () => {
  const source = await readFile(
    new URL('../src/components/color-picker/index.tsx', import.meta.url),
    'utf8'
  );
  assertDisabledActionContract(source);
});

test('the copied color picker source retains the disabled action contract', async () => {
  const item = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/color-picker.json', import.meta.url),
      'utf8'
    )
  );
  const copied = item.files.find((file) => file.path === 'ui/color-picker.tsx').content;
  assertDisabledActionContract(copied);
  assert.ok(
    item.files.some((file) => file.path === 'ui/color-picker-accessibility.ts'),
    'registry output must include the action guard'
  );
});
