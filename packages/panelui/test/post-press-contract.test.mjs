import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/post/index.tsx', import.meta.url), 'utf8');

function assertOwnedContracts(content) {
  assert.match(content, /<AnimatedPressable\s*ref=\{ref\}\s*\{\.\.\.props\}\s*accessibilityRole="link"\s*onPress=\{onPress\}/);
  assert.match(content, /<Pressable\s*ref=\{ref\}\s*\{\.\.\.props\}\s*accessibilityRole="imagebutton"\s*accessibilityLabel=\{alt\}\s*onPress=\{onPress\}/);
  assert.match(content, /<View ref=\{ref\} \{\.\.\.props\} className=\{root\(\{ className \}\)\}>/);
  assert.match(content, /<View ref=\{ref\} \{\.\.\.props\} className=\{media\(\{ className \}\)\} style=\{\{ aspectRatio \}\}>/);
}

test('Post root and media own their rendered contracts', () => assertOwnedContracts(source));

test('the copied Post source retains all rendered contracts', async () => {
  const item = JSON.parse(await readFile(new URL('../../../apps/docs/public/r/post.json', import.meta.url), 'utf8'));
  assertOwnedContracts(item.files.find((file) => file.path === 'ui/post.tsx').content);
});
