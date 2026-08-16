import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/table/index.tsx', import.meta.url), 'utf8');

function assertOwnedContracts(content) {
  assert.match(content, /<View\s*ref=\{ref\}\s*\{\.\.\.\(props as ViewProps\)\}\s*role="row"[\s\S]*accessibilityState=\{\{ disabled: !!disabled, selected: !!selected \}\}/);
  assert.match(content, /<AnimatedPressable\s*ref=\{ref\}\s*\{\.\.\.props\}[\s\S]*accessibilityRole="button"[\s\S]*onPress=\{onPress\}/);
}

test('Table.Row owns its static and interactive semantic contracts', () => assertOwnedContracts(source));

test('the copied Table source retains both row contracts', async () => {
  const item = JSON.parse(await readFile(new URL('../../../apps/docs/public/r/table.json', import.meta.url), 'utf8'));
  assertOwnedContracts(item.files.find((file) => file.path === 'ui/table.tsx').content);
});
