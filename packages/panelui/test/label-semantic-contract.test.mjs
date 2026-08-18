import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url);
const sourcePath = new URL('packages/panelui/src/components/label/index.tsx', ROOT);
const registryPath = new URL('apps/docs/public/r/label.json', ROOT);

function assertDisabledOwnership(source) {
  assert.match(
    source,
    /<View\s+ref=\{ref\}\s+\{\.\.\.props\}\s+className=\{root\(\{ className \}\)\}\s+accessibilityState=\{\{ disabled: isDisabled \}\}/,
    'Label must apply inherited props before its owned disabled state'
  );
}

test('Label keeps visual and announced disabled state aligned', async () => {
  assertDisabledOwnership(await readFile(sourcePath, 'utf8'));
});

test('the copied Label source retains disabled-state ownership', async () => {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const file = registry.files.find((candidate) => candidate.path === 'ui/label.tsx');
  assert.ok(file, 'registry must contain copied Label source');
  assertDisabledOwnership(file.content);
});
