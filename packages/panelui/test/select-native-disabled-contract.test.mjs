import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { nativeSelectSupportsOptions } from '../src/components/select/native-select-contract.ts';

const source = await readFile(
  new URL('../src/components/select/index.tsx', import.meta.url),
  'utf8'
);
const helperSource = await readFile(
  new URL('../src/components/select/native-select-contract.ts', import.meta.url),
  'utf8'
);

test('native Select is available when every option is selectable', () => {
  assert.equal(nativeSelectSupportsOptions([]), true);
  assert.equal(
    nativeSelectSupportsOptions([{ disabled: false }, {}, { disabled: undefined }]),
    true
  );
});

test('native Select falls back when an option is disabled', () => {
  assert.equal(
    nativeSelectSupportsOptions([{ disabled: false }, { disabled: true }]),
    false
  );
});

test('Select gates the native picker on per-option support', () => {
  assert.match(
    source,
    /native && nativeSelectSupportsOptions\(options\) \? getNativeUI\(\) : null/
  );
});

test('the copied-source registry ships the native option contract', async () => {
  const registry = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/select.json', import.meta.url),
      'utf8'
    )
  );
  const files = new Map(registry.files.map((file) => [file.path, file.content]));

  assert.equal(files.get('ui/native-select-contract.ts'), helperSource);
  assert.match(
    files.get('ui/select.tsx'),
    /from '@\/components\/ui\/native-select-contract'/
  );
});
