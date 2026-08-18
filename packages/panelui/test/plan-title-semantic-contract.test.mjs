import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url);
const sourcePath = new URL('packages/panelui/src/components/plan/index.tsx', ROOT);
const registryPath = new URL('apps/docs/public/r/plan.json', ROOT);

function assertTitleOwnership(source) {
  assert.match(
    source,
    /<Shimmer accessibilityRole="header" textClassName=\{cn\(title\(\), className\)\}>/,
    'streaming Plan.Title must retain its heading semantic'
  );
  assert.match(
    source,
    /<Text \{\.\.\.props\} accessibilityRole="header" className=\{cn\(title\(\), className\)\}>/,
    'settled Plan.Title must apply inherited props before its owned header role'
  );
}

test('Plan.Title stays a heading while streaming and settled', async () => {
  assertTitleOwnership(await readFile(sourcePath, 'utf8'));
});

test('the copied Plan source retains title semantics', async () => {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const file = registry.files.find((candidate) => candidate.path === 'ui/plan.tsx');
  assert.ok(file, 'registry must contain copied Plan source');
  assertTitleOwnership(file.content);
});
