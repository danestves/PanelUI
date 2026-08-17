import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/components/accordion/index.tsx', import.meta.url),
  'utf8'
);

test('Accordion.Trigger owns one composed Pressable contract', () => {
  assert.match(source, /extends Omit<PressableProps, 'children'>/);
  assert.match(source, /const triggerDisabled = Boolean\(isDisabled \|\| disabled\)/);
  assert.match(source, /onPress\?\.\(event\);\s*toggle\(value\)/);
  assert.match(
    source,
    /\{\.\.\.props\}\s*accessibilityRole="button"[\s\S]*onPress=\{\(event\) =>/
  );
});

test('the copied Accordion source retains the trigger contract', async () => {
  const item = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/accordion.json', import.meta.url),
      'utf8'
    )
  );
  const copied = item.files.find((file) => file.path === 'ui/accordion.tsx').content;
  assert.match(copied, /extends Omit<PressableProps, 'children'>/);
  assert.match(copied, /onPress\?\.\(event\);\s*toggle\(value\)/);
});
