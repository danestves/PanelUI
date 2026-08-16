import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/panelside/index.tsx', import.meta.url), 'utf8');

function assertTriggerContract(content) {
  assert.match(content, /children\.props\.onPress\?\.\(\.\.\.args\);\s*onPress\?\.\([\s\S]*args as Parameters[\s\S]*\);\s*toggle\(\)/);
  assert.match(content, /<AnimatedPressable\s*\{\.\.\.props\}\s*onPress=\{\(event\) => \{\s*onPress\?\.\(event\);\s*toggle\(\)/);
  assert.match(content, /accessibilityRole="button"\s*accessibilityLabel=\{label\}/);
}

test('Panelside.Trigger composes custom and default trigger presses', () => assertTriggerContract(source));

test('the copied Panelside source retains the trigger contract', async () => {
  const item = JSON.parse(await readFile(new URL('../../../apps/docs/public/r/panelside.json', import.meta.url), 'utf8'));
  assertTriggerContract(item.files.find((file) => file.path === 'ui/panelside.tsx').content);
});
