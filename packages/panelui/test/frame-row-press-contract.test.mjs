import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/frame/index.tsx', import.meta.url), 'utf8');

function assertOwnedContracts(content) {
  assert.match(content, /<View ref=\{ref\} \{\.\.\.\(props as ViewProps\)\} className=\{classes\}>/);
  assert.match(content, /<Pressable\s*ref=\{ref\}\s*\{\.\.\.props\}\s*accessibilityRole="button"\s*onPress=\{onPress\}\s*className=\{classes\}/);
}

test('Frame.Row owns its rendered class and interactive contract', () => assertOwnedContracts(source));

test('the copied Frame source retains both row contracts', async () => {
  const item = JSON.parse(await readFile(new URL('../../../apps/docs/public/r/frame.json', import.meta.url), 'utf8'));
  assertOwnedContracts(item.files.find((file) => file.path === 'ui/frame.tsx').content);
});
