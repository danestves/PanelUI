import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url);
const sourcePath = new URL('packages/panelui/src/components/toast/index.tsx', ROOT);
const registryPath = new URL('apps/docs/public/r/toast.json', ROOT);

function assertAlertOwnership(source) {
  assert.match(
    source,
    /<View\s+\{\.\.\.props\}\s+accessibilityRole="alert"\s+accessibilityLiveRegion="polite"\s+className=/,
    'Toast must apply inherited props before its owned alert announcement contract'
  );
}

test('Toast owns its alert and polite live-region semantics', async () => {
  assertAlertOwnership(await readFile(sourcePath, 'utf8'));
});

test('the copied Toast source retains its announcement contract', async () => {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const file = registry.files.find((candidate) => candidate.path === 'ui/toast.tsx');
  assert.ok(file, 'registry must contain copied Toast source');
  assertAlertOwnership(file.content);
});
