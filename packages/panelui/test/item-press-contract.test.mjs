import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/item/index.tsx', import.meta.url), 'utf8');

function assertOwnedContracts(content) {
  assert.match(content, /<View\s*ref=\{ref\}\s*\{\.\.\.\(props as ViewProps\)\}\s*accessibilityState=\{\{ disabled: !!disabled \}\}/);
  assert.match(content, /<AnimatedPressable\s*ref=\{ref\}\s*\{\.\.\.props\}\s*accessibilityRole="button"[\s\S]*onPress=\{onPress\}/);
}

test('Item owns static and pressable semantics after forwarded props', () => assertOwnedContracts(source));

test('the copied Item source retains both owned contracts', async () => {
  const item = JSON.parse(await readFile(new URL('../../../apps/docs/public/r/item.json', import.meta.url), 'utf8'));
  assertOwnedContracts(item.files.find((file) => file.path === 'ui/item.tsx').content);
});
