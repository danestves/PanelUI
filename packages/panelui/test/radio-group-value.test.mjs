import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { requestRadioValueChange } from '../src/components/radio-group/radio-group-value.ts';

test('selecting a different radio item reports one value change', () => {
  const changes = [];

  requestRadioValueChange('free', 'pro', (value) => changes.push(value));

  assert.deepEqual(changes, ['pro']);
});

test('pressing the selected radio item is a no-op', () => {
  const changes = [];

  requestRadioValueChange('pro', 'pro', (value) => changes.push(value));

  assert.deepEqual(changes, []);
});

test('the item press path uses the guarded value-change contract', async () => {
  const source = await readFile(
    new URL('../src/components/radio-group/index.tsx', import.meta.url),
    'utf8'
  );

  assert.match(
    source,
    /requestRadioValueChange\(context\.value, value, context\.onValueChange\)/
  );
});

test('the generated registry ships the guarded interaction helper', async () => {
  const registry = JSON.parse(
    await readFile(new URL('../../../apps/docs/public/r/radio-group.json', import.meta.url), 'utf8')
  );
  const helper = registry.files.find((file) => file.path === 'ui/radio-group-value.ts');

  assert.ok(helper, 'radio group registry item should include its value-change helper');
  assert.match(helper.content, /currentValue !== nextValue/);
});
