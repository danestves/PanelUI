import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/components/toggle-button/index.tsx', import.meta.url),
  'utf8'
);

function assertOwnedPressContract(content) {
  assert.match(
    content,
    /<AnimatedPressable\s*ref=\{ref\}\s*\{\.\.\.props\}\s*accessibilityRole="button"[\s\S]*accessibilityState=\{\{ checked: selected, disabled: isDisabled, selected \}\}[\s\S]*onPress=\{handlePress\}/
  );
  assert.match(content, /onPress\?\.\(event\);[\s\S]*group\.toggle\(id\)/);
}

test('ToggleButton owns its semantics and state transition after forwarded props', () => {
  assertOwnedPressContract(source);
});

test('the copied ToggleButton source retains the owned press contract', async () => {
  const item = JSON.parse(
    await readFile(
      new URL('../../../apps/docs/public/r/toggle-button.json', import.meta.url),
      'utf8'
    )
  );
  const copied = item.files.find((file) => file.path === 'ui/toggle-button.tsx').content;
  assertOwnedPressContract(copied);
});
