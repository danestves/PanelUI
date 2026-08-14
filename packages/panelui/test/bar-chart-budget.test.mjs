import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  BAR_CHART_BUDGET,
  barChartOperationCounts,
} from '../scripts/benchmark-bar-chart.mjs';

const source = await readFile(
  new URL('../src/components/bar-chart/index.tsx', import.meta.url),
  'utf8'
);
const usage = await readFile(
  new URL('../../../apps/docs/scripts/usage/bar-chart.json', import.meta.url),
  'utf8'
);

test('the operation model matches BarChart data-dependent passes', () => {
  assert.match(source, /for \(const row of data\)[\s\S]*for \(const key of keys\)/);
  assert.match(source, /return data\.map\(\(row\) => \{[\s\S]*for \(const \[key\] of below\)/);
  assert.match(source, /for \(let i = 0; i < total; i\+\+\)/);
  assert.equal(source.match(/useAnimatedProps\(build\((?:false|true)\)\)/g)?.length, 2);
});

test('representative grouped and stacked workloads have deterministic costs', () => {
  const expected = [
    [100, 1, 100, 200, 100],
    [100, 3, 300, 600, 600],
    [100, 5, 500, 1_000, 1_500],
    [500, 1, 500, 1_000, 500],
    [500, 3, 1_500, 3_000, 3_000],
    [500, 5, 2_500, 5_000, 7_500],
    [1_000, 1, 1_000, 2_000, 1_000],
    [1_000, 3, 3_000, 6_000, 6_000],
    [1_000, 5, 5_000, 10_000, 15_000],
  ];

  for (const [points, series, groupedUpdate, frame, stackedUpdate] of expected) {
    assert.deepEqual(barChartOperationCounts(points, series, false), {
      updateVisits: groupedUpdate,
      frameVisits: frame,
    });
    assert.deepEqual(barChartOperationCounts(points, series, true), {
      updateVisits: stackedUpdate,
      frameVisits: frame,
    });
  }
});

test('the documented recommendation and tested ceiling stay inside reviewable budgets', () => {
  assert.deepEqual(BAR_CHART_BUDGET.recommended, { points: 500, series: 4 });
  assert.deepEqual(BAR_CHART_BUDGET.testedCeiling, { points: 1_000, series: 5 });
  assert.match(usage, /500 rows or fewer and no more than four `Bar` series/);
  assert.match(usage, /1,000 rows by five series/);
  assert.match(usage, /`2 × rows × series`/);
  assert.deepEqual(barChartOperationCounts(500, 4, true), {
    updateVisits: 5_000,
    frameVisits: 4_000,
  });
  assert.deepEqual(barChartOperationCounts(1_000, 5, true), {
    updateVisits: 15_000,
    frameVisits: 10_000,
  });
});
