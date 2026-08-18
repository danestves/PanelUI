import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chartAccessibilityModel } from '../src/primitives/chart-accessibility.ts';

const ROOT = new URL('../../../', import.meta.url);

function assertPlot(source) {
  assert.match(source, /extends ViewProps, ChartAccessibilityProps<PlotDatum>/);
  assert.match(source, /<ChartAccessibilityData\s+chart="Plot"\s+data=\{data\}/);
  assert.match(source, /seriesKeys\.map\(\(key\) => \[key, datum\[key\]\]/);
  assert.match(source, /accessibilityElementsHidden\s+importantForAccessibility="no-hide-descendants"/);
}

function assertWaterfall(source) {
  assert.match(source, /extends ViewProps, ChartAccessibilityProps<WaterfallStep>/);
  assert.match(source, /<ChartAccessibilityData\s+chart="Waterfall chart"\s+data=\{steps\}/);
  for (const label of ['change', 'kind', 'starts at', 'ends at']) assert.match(source, new RegExp(`\\['${label}'`));
  assert.match(source, /accessibilityElementsHidden\s+importantForAccessibility="no-hide-descendants"/);
}

test('Plot and Waterfall expose structured semantic data beside decorative geometry', async () => {
  assertPlot(await readFile(new URL('packages/panelui/src/components/plot/index.tsx', ROOT), 'utf8'));
  assertWaterfall(await readFile(new URL('packages/panelui/src/components/waterfall-chart/index.tsx', ROOT), 'utf8'));

  const step = { datum: { label: 'Costs', value: -20 }, label: 'Costs', value: -20, kind: 'fall', start: 100, end: 80 };
  const model = chartAccessibilityModel('Waterfall chart', [step], (item) => [
    ['label', item.label], ['change', item.value], ['kind', item.kind], ['starts at', item.start], ['ends at', item.end],
  ]);
  assert.equal(model.items[0].label, 'label, Costs. change, -20. kind, fall. starts at, 100. ends at, 80');
});

test('registry copies retain Plot and Waterfall accessibility contracts', async () => {
  for (const [name, check] of [['plot', assertPlot], ['waterfall-chart', assertWaterfall]]) {
    const item = JSON.parse(await readFile(new URL(`apps/docs/public/r/${name}.json`, ROOT), 'utf8'));
    const file = item.files.find((candidate) => candidate.path === `ui/${name}.tsx`);
    assert.ok(file, `registry must contain ${name}`);
    check(file.content);
  }
});
