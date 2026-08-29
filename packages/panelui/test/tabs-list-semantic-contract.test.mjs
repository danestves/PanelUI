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
  // The same row in both layouts, wrapped once so the triggers inside it know
  // which one they are in before they are measured.
  assert.match(
    source,
    /const row = \([\s\S]*<TabsListContext\.Provider value=\{scrollable\}>\{row\}[\s\S]*if \(!scrollable\) return scoped;[\s\S]*\{scoped\}/
  );
});

test('the copied Tabs source retains the list semantic contract', async () => {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const file = registry.files.find((candidate) => candidate.path === 'ui/tabs.tsx');
  assert.ok(file, 'registry must contain copied Tabs source');
  assertTabListOwnership(file.content);
});
