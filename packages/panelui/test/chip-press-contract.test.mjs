import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/chip/index.tsx', import.meta.url), 'utf8');

function assertOwnedPressContract(content) {
  assert.match(
    content,
    /<AnimatedPressable\s*ref=\{ref\}\s*\{\.\.\.props\}\s*\{\.\.\.sharedProps\}\s*onPress=\{handlePress\}/
  );
  assert.match(content, /if \(haptics\) selectionTick\(\);\s*onPress\?\.\(event\)/);
}

test('pressable Chip owns its semantics and haptic handler after forwarded props', () => {
  assertOwnedPressContract(source);
});

test('the copied Chip source retains the owned press contract', async () => {
  const item = JSON.parse(
    await readFile(new URL('../../../apps/docs/public/r/chip.json', import.meta.url), 'utf8')
  );
  const copied = item.files.find((file) => file.path === 'ui/chip.tsx').content;
  assertOwnedPressContract(copied);
});
