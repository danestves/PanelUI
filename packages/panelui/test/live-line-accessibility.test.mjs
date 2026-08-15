import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { liveLineAccessibility } from '../src/components/live-line-chart/live-line-accessibility.ts';

const base = {
  name: 'Requests per second',
  status: 'ready',
  latest: { time: 99_000, value: 42 },
  activePoint: null,
  momentum: 'up',
  windowSeconds: 30,
  paused: false,
  now: 100_000,
  formatLatest: (value) => `${value} req/s`,
  formatActive: (value) => `${value} req/s`,
};

test('a live stream is one named current-value snapshot', () => {
  assert.deepEqual(liveLineAccessibility(base), {
    label:
      'Requests per second. Current value, 42 req/s. Trend, rising. 30-second window',
  });
});

test('loading and empty streams are distinct without duplicate state speech', () => {
  assert.deepEqual(
    liveLineAccessibility({ ...base, status: 'loading', latest: null }),
    { label: 'Requests per second. Loading' }
  );
  assert.deepEqual(liveLineAccessibility({ ...base, latest: null }), {
    label: 'Requests per second. No readings',
  });
});

test('paused streams retain their held reading without claiming a live update', () => {
  const model = liveLineAccessibility({
    ...base,
    paused: true,
    momentum: 'down',
    valueOverride: '42 requests',
  });
  assert.equal(
    model.label,
    'Requests per second. Current value, 42 requests. Trend, falling. 30-second window. Paused'
  );
});

test('a selected point replaces the current trend with value and relative time', () => {
  const model = liveLineAccessibility({
    ...base,
    activePoint: { time: 93_600, value: 37 },
    formatActive: (value) => `${value} selected`,
  });
  assert.equal(
    model.label,
    'Requests per second. Selected value, 37 selected. 6 seconds ago. 30-second window'
  );
});

test('the semantic node has an honest generic name and never gains actions', () => {
  assert.match(liveLineAccessibility({ ...base, name: undefined }).label, /^Live line chart\./);
});

test('visual chart text is hidden while header action children stay outside the hidden subtree', async () => {
  const source = await readFile(
    new URL('../src/components/live-line-chart/index.tsx', import.meta.url),
    'utf8'
  );
  assert.match(source, /accessibilityRole="image"/);
  assert.match(source, /accessibilityLabel=\{semantic\.label\}/);
  assert.match(source, /accessibilityElementsHidden/g);
  assert.match(source, /importantForAccessibility="no-hide-descendants"/g);
  assert.doesNotMatch(source, /accessibilityLiveRegion|accessibilityActions|adjustable/);
  assert.match(
    source,
    /accessibilityElementsHidden[\s\S]*?<\/View>\s*\{children \? <View className="max-w-\[55%\]/
  );
});

test('the copied chart ships its semantic helper', async () => {
  const registry = JSON.parse(
    await readFile(new URL('../../../apps/docs/public/r/live-line-chart.json', import.meta.url))
  );
  const helper = registry.files.find(
    (file) => file.path === 'ui/live-line-accessibility.ts'
  );
  assert.match(helper?.content ?? '', /export function liveLineAccessibility/);
});
