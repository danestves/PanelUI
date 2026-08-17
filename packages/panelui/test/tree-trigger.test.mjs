import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/components/tree/index.tsx', import.meta.url),
  'utf8'
);

test('Tree.Trigger owns one composed Pressable contract', () => {
  assert.match(source, /extends Omit<PressableProps, 'children'>/);
  assert.match(source, /const triggerDisabled = Boolean\(isDisabled \|\| disabled\)/);
  assert.match(source, /select\(value\);\s*onPress\?\.\(event\)/);
  assert.match(source, /\{\.\.\.props\}\s*onPress=\{handlePress\}/);
});

test('the copied Tree source retains the trigger contract', async () => {
  const item = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/tree.json', import.meta.url),
      'utf8'
    )
  );
  const copied = item.files.find((file) => file.path === 'ui/tree.tsx').content;
  assert.match(copied, /extends Omit<PressableProps, 'children'>/);
  assert.match(copied, /onPress\?\.\(event\)/);
});
