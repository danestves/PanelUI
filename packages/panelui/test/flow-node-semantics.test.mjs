import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/flow/index.tsx', import.meta.url), 'utf8');

function assertNodeContract(content) {
  assert.match(content, /<Animated\.View\s*\{\.\.\.props\}\s*collapsable=\{false\}[\s\S]*accessible\s*accessibilityRole=\{onPress \? 'button' : 'none'\}[\s\S]*accessibilityActions=\{nodeActions\}\s*onAccessibilityAction=\{handleAccessibilityAction\}/);
  assert.match(content, /\.\.\.\(accessibilityActions \?\? \[\]\)/);
  assert.match(content, /onAccessibilityAction\?\.\(event\)/);
}

test('Flow.Node owns required semantics after forwarding other view props', () => assertNodeContract(source));

test('the copied Flow source retains the node semantic contract', async () => {
  const item = JSON.parse(await readFile(new URL('../../../apps/docs/public/r/flow.json', import.meta.url), 'utf8'));
  assertNodeContract(item.files.find((file) => file.path === 'ui/flow.tsx').content);
});
