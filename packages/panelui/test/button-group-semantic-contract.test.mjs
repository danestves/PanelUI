import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url);
const sourcePath = new URL(
  'packages/panelui/src/components/button-group/index.tsx',
  ROOT
);
const registryPath = new URL('apps/docs/public/r/button-group.json', ROOT);

function assertToolbarOwnership(source) {
  assert.match(
    source,
    /<View\s+ref=\{ref\}\s+\{\.\.\.props\}[\s\S]{0,300}accessibilityRole="toolbar"\s+className=/,
    'ButtonGroup must apply inherited props before its owned toolbar role'
  );
}

test('ButtonGroup owns its toolbar role after inherited props', async () => {
  assertToolbarOwnership(await readFile(sourcePath, 'utf8'));
});

test('the copied ButtonGroup source retains the toolbar contract', async () => {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const file = registry.files.find(
    (candidate) => candidate.path === 'ui/button-group.tsx'
  );
  assert.ok(file, 'registry must contain copied ButtonGroup source');
  assertToolbarOwnership(file.content);
});
