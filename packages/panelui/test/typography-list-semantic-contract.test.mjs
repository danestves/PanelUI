import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url);
const sourcePath = new URL('packages/panelui/src/components/typography/index.tsx', ROOT);
const registryPath = new URL('apps/docs/public/r/typography.json', ROOT);

function assertListSemantics(source) {
  assert.match(
    source,
    /<View ref=\{ref\} \{\.\.\.props\} accessibilityRole="list" className=\{cn\('gap-2', className\)\}>/,
    'Typography.List must apply inherited props before its owned list role'
  );
  assert.match(
    source,
    /Children\.map\(children,[\s\S]{0,160}<View role="listitem" className="w-full flex-row gap-2">/,
    'every rendered Typography.List row must expose listitem semantics'
  );
}

test('Typography.List owns a complete list and listitem structure', async () => {
  assertListSemantics(await readFile(sourcePath, 'utf8'));
});

test('the copied Typography source retains list semantics', async () => {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const file = registry.files.find((candidate) => candidate.path === 'ui/typography.tsx');
  assert.ok(file, 'registry must contain copied Typography source');
  assertListSemantics(file.content);
});
