import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url);
const sourcePath = new URL('packages/panelui/src/components/tabs/index.tsx', ROOT);
const registryPath = new URL('apps/docs/public/r/tabs.json', ROOT);

function assertTabListOwnership(source) {
  assert.match(
    source,
    /<View \{\.\.\.props\} accessibilityRole="tablist" className=\{cn\(list\(\), className\)\}>/,
    'Tabs.List must apply inherited props before its owned tablist role'
  );
}

test('Tabs.List owns the tablist role in fixed and scrollable layouts', async () => {
  const source = await readFile(sourcePath, 'utf8');
  assertTabListOwnership(source);
  assert.match(source, /const row = \([\s\S]*if \(!scrollable\) return row;[\s\S]*\{row\}/);
});

test('the copied Tabs source retains the list semantic contract', async () => {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const file = registry.files.find((candidate) => candidate.path === 'ui/tabs.tsx');
  assert.ok(file, 'registry must contain copied Tabs source');
  assertTabListOwnership(file.content);
});
