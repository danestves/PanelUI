import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url);

function assertSplitView(source) {
  assert.match(source, /<View\s+\{\.\.\.props\}\s+accessible\s+accessibilityRole="adjustable"[\s\S]{0,900}accessibilityState=\{\{ disabled \}\}/);
}

function assertSplitter(source) {
  assert.match(source, /<Animated\.View\s+\{\.\.\.props\}\s+accessible\s+accessibilityRole="adjustable"[\s\S]{0,700}accessibilityState=\{\{ disabled: frozen \}\}/);
  assert.match(source, /className=\{handle\(\{ className \}\)\}\s+style=\{\[style, animatedStyle\]\}/);
}

test('SplitView and Splitter seams own their adjustable disabled contracts', async () => {
  assertSplitView(await readFile(new URL('packages/panelui/src/components/split-view/index.tsx', ROOT), 'utf8'));
  assertSplitter(await readFile(new URL('packages/panelui/src/components/splitter/index.tsx', ROOT), 'utf8'));
});

test('registry copies retain seam semantic ownership', async () => {
  for (const [name, check] of [['split-view', assertSplitView], ['splitter', assertSplitter]]) {
    const item = JSON.parse(await readFile(new URL(`apps/docs/public/r/${name}.json`, ROOT), 'utf8'));
    const file = item.files.find((candidate) => candidate.path === `ui/${name}.tsx`);
    assert.ok(file, `registry must contain ${name}`);
    check(file.content);
  }
});
