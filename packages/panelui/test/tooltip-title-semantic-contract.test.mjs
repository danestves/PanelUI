import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url);
const sourcePath = new URL('packages/panelui/src/components/tooltip/index.tsx', ROOT);
const registryPath = new URL('apps/docs/public/r/tooltip.json', ROOT);

function assertTitleOwnership(source) {
  assert.match(
    source,
    /<Text \{\.\.\.props\} accessibilityRole="header" className=\{cn\(title\(\), className\)\} \/>/,
    'Tooltip.Title must apply inherited props before its owned header role'
  );
}

test('Tooltip.Title owns its heading semantic', async () => {
  assertTitleOwnership(await readFile(sourcePath, 'utf8'));
});

test('the copied Tooltip source retains title semantics', async () => {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const file = registry.files.find((candidate) => candidate.path === 'ui/tooltip.tsx');
  assert.ok(file, 'registry must contain copied Tooltip source');
  assertTitleOwnership(file.content);
});
