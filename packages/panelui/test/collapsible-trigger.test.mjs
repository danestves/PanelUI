import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/components/collapsible/index.tsx', import.meta.url),
  'utf8'
);
const registry = JSON.parse(
  await readFile(
    new URL('../../../apps/docs/public/r/collapsible.json', import.meta.url),
    'utf8'
  )
).files.find((file) => file.path === 'ui/collapsible.tsx').content;

test('Collapsible.Trigger exposes and composes the Pressable contract', () => {
  assert.match(source, /extends Omit<PressableProps, 'children'>/);
  assert.match(
    source,
    /onPress=\{\(event\) => \{\s*onPress\?\.\(event\);\s*toggle\(\);\s*\}\}/
  );
});

test('the copied Collapsible source retains the trigger contract', () => {
  assert.match(registry, /Omit<PressableProps, 'children'>/);
  assert.match(registry, /onPress\?\.\(event\);\s*toggle\(\);/);
});
