import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/carousel/index.tsx', import.meta.url), 'utf8');

function assertArrowContract(content) {
  assert.match(content, /<Pressable\s*\{\.\.\.props\}\s*disabled=\{disabled\}\s*onPress=\{direction === 'next' \? next : previous\}[\s\S]*accessibilityState=\{\{ disabled \}\}/);
}

test('Carousel arrows keep navigation and disabled semantics after forwarded props', () => assertArrowContract(source));

test('the copied Carousel source retains the arrow contract', async () => {
  const item = JSON.parse(await readFile(new URL('../../../apps/docs/public/r/carousel.json', import.meta.url), 'utf8'));
  assertArrowContract(item.files.find((file) => file.path === 'ui/carousel.tsx').content);
});
