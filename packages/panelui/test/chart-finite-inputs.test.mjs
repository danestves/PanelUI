import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  finiteChartDomain,
  finiteChartNumber,
} from '../src/primitives/finite-chart.ts';

test('chart arithmetic accepts finite numbers only', () => {
  assert.equal(finiteChartNumber(12.5), 12.5);
  for (const value of [Number.NaN, Infinity, -Infinity, '12', null]) {
    assert.equal(finiteChartNumber(value), undefined);
  }
});

test('an explicit chart domain requires two finite ends', () => {
  assert.deepEqual(finiteChartDomain([-10, 20]), [-10, 20]);
  assert.equal(finiteChartDomain([0, Infinity]), undefined);
  assert.equal(finiteChartDomain([-Infinity, 0]), undefined);
  assert.equal(finiteChartDomain([Number.NaN, 1]), undefined);
});

test('Plot and Waterfall guard every audited data and domain boundary', async () => {
  const plot = await readFile(
    new URL('../src/components/plot/index.tsx', import.meta.url),
    'utf8'
  );
  const waterfall = await readFile(
    new URL('../src/components/waterfall-chart/index.tsx', import.meta.url),
    'utf8'
  );

  assert.match(plot, /finiteChartNumber\(yDomain\?\.\[0\]\)/);
  assert.match(plot, /const value = finiteChartNumber\(row\[key\]\)/);
  assert.match(waterfall, /finiteChartNumber\(datum\.value\) \?\? 0/);
  assert.match(waterfall, /finiteChartDomain\(yDomain\)/);
});
