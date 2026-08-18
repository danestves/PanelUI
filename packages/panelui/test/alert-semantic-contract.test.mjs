import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/components/alert/index.tsx', import.meta.url),
  'utf8'
);

test('Alert owns its live status semantics after forwarded props', () => {
  assert.match(
    source,
    /<View\s+ref=\{ref\}\s+\{\.\.\.props\}\s+accessibilityRole="alert"\s+className=/
  );
});

test('the copied Alert source retains owned status semantics', async () => {
  const item = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/alert.json', import.meta.url),
      'utf8'
    )
  );
  const copied = item.files.find((file) => file.path === 'ui/alert.tsx').content;
  assert.match(copied, /\{\.\.\.props\}\s+accessibilityRole="alert"/);
});
