import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../../../', import.meta.url);

function linear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
function contrast(foreground, background) {
  const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function composite(foreground, background, opacity) {
  return foreground.map((channel, index) => Math.round(channel * opacity + background[index] * (1 - opacity)));
}
function assertSource(source) {
  const column = source.match(/const columnStyle = useAnimatedStyle\(\(\) => \{[\s\S]*?\n    \}\);/)?.[0];
  assert.ok(column, 'Timeline must keep its horizontal focus transform');
  assert.doesNotMatch(column, /opacity/);
  assert.match(column, /scale: 1 - away \* 0\.04/);
  assert.match(column, /translateY: away \* 4/);
  assert.doesNotMatch(source, /const bodyStyle = useAnimatedStyle/);
  assert.match(source, /<Animated\.View[\s\S]{0,220}style=\{style\}/);
}

test('horizontal Timeline keeps informative content fully opaque', async () => {
  assertSource(await readFile(new URL('packages/panelui/src/components/timeline/index.tsx', ROOT), 'utf8'));
  const white = [255, 255, 255], black = [0, 0, 0];
  assert.ok(contrast(composite(black, white, 0.18), white) < 2, 'old nested opacity could never meet AA');
  assert.ok(contrast(composite(black, white, 1), white) >= 4.5, 'full-opacity text preserves its token contrast');
});

test('the copied Timeline retains full-opacity content focus', async () => {
  const item = JSON.parse(await readFile(new URL('apps/docs/public/r/timeline.json', ROOT), 'utf8'));
  const file = item.files.find((candidate) => candidate.path === 'ui/timeline.tsx');
  assert.ok(file);
  assertSource(file.content);
});
