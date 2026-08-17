import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/fab/index.tsx', import.meta.url), 'utf8');

test('Fab exposes and composes the AnimatedPressable contract', () => {
  assert.match(source, /Omit<AnimatedPressableProps, 'children' \| 'style' \| 'disabled'>/);
  assert.match(source, /onPress\?\.\(event\)/);
  assert.match(
    source,
    /<AnimatedPressable\s*ref=\{ref\}\s*\{\.\.\.props\}[\s\S]*accessibilityRole="button"[\s\S]*onPress=\{handlePress\}/
  );
});

test('the copied Fab source retains the press contract', async () => {
  const item = JSON.parse(
    await readFile(new URL('../../../apps/docs/public/r/fab.json', import.meta.url), 'utf8')
  );
  const copied = item.files.find((file) => file.path === 'ui/fab.tsx').content;
  assert.match(copied, /Omit<AnimatedPressableProps, 'children' \| 'style' \| 'disabled'>/);
  assert.match(copied, /onPress\?\.\(event\)/);
});
