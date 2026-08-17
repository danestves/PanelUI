import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/menu/index.tsx', import.meta.url), 'utf8');

function assertItemContract(content) {
  assert.match(content, /<AnimatedPressable\s*\{\.\.\.props\}\s*accessibilityRole="menuitem"[\s\S]*onPress=\{handlePress\}/);
  assert.match(content, /onPressIn\?\.\(event\);\s*press\.onPressIn\(\)/);
  assert.match(content, /onPressOut\?\.\(event\);\s*press\.onPressOut\(\)/);
  assert.match(content, /onPress\?\.\(\.\.\.args\);\s*onSelect\?\.\(\);[\s\S]*close\(\)/);
}

test('Menu.Item composes consumer press lifecycle with owned behavior', () => assertItemContract(source));

test('the copied Menu source retains the item press contract', async () => {
  const item = JSON.parse(await readFile(new URL('../../../apps/docs/public/r/menu.json', import.meta.url), 'utf8'));
  assertItemContract(item.files.find((file) => file.path === 'ui/menu.tsx').content);
});
