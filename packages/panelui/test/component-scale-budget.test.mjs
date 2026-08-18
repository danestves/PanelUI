import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  COMPONENT_SCALE_BUDGETS,
  componentScaleReport,
  formatComponentScaleReport,
} from '../scripts/benchmark-component-scale.mjs';

test('component scale attribution is deterministic and within every local budget', () => {
  const first = componentScaleReport();
  const second = componentScaleReport();
  assert.deepEqual(first, second);
  assert.equal(first.length, 8);
  for (const row of first) assert.ok(row.measured <= row.budget, row.component);
  assert.match(formatComponentScaleReport(first), /component\tworkload\tmeasured\tbudget\theadroom/);
});

test('component scale attribution identifies each exceeded owner together', () => {
  const budgets = Object.fromEntries(Object.keys(COMPONENT_SCALE_BUDGETS).map((key) => [key, 0]));
  const failures = componentScaleReport({ budgets }).filter((row) => row.measured > row.budget);
  assert.deepEqual(failures.map((row) => row.component), [
    'Marquee repeated subtrees',
    'Timeline compound items',
    'BarChart update visits',
    'BarChart frame visits',
    'MessageScroller initial rows',
    'MessageScroller batch rows',
    'MessageScroller window screens',
    'TimePicker mounted ticks',
  ]);
});

test('the performance gate and guide own the component attribution command', async () => {
  const rootPackage = await readFile(new URL('../../../package.json', import.meta.url), 'utf8');
  const packageManifest = await readFile(new URL('../package.json', import.meta.url), 'utf8');
  const guide = await readFile(new URL('../../../apps/docs/content/docs/performance.mdx', import.meta.url), 'utf8');
  assert.match(packageManifest, /"benchmark:components": "node --experimental-strip-types scripts\/benchmark-component-scale\.mjs"/);
  assert.match(rootPackage, /performance:check[^\n]+benchmark:components/);
  assert.match(guide, /npm run benchmark:components --workspace=panelui-native/);
  assert.match(guide, /40 compound Timeline items/);
});
