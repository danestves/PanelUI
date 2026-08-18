import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/components/field/index.tsx', import.meta.url),
  'utf8'
);

const contracts = [
  /\{\.\.\.props\}\s+role="group"\s+accessibilityState=\{\{ disabled \}\}/,
  /<View\s+ref=\{ref\}\s+\{\.\.\.props\}[\s\S]{0,300}role="alert"\s+accessibilityLiveRegion="polite"/,
  /<View ref=\{ref\} \{\.\.\.props\} role="group" className=/,
  /<Text ref=\{ref\} \{\.\.\.props\} role="heading" className=/,
];

test('Field compound parts own their semantic roles after forwarded props', () => {
  for (const contract of contracts) assert.match(source, contract);
});

test('the copied Field source retains owned compound semantics', async () => {
  const item = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/field.json', import.meta.url),
      'utf8'
    )
  );
  const copied = item.files.find((file) => file.path === 'ui/field.tsx').content;
  for (const contract of contracts) assert.match(copied, contract);
});
