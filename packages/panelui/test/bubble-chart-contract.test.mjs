import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/components/bubble-chart/index.tsx', import.meta.url),
  'utf8'
);

test('the grid and the axes agree about how often a line is named', async () => {
  // Eight rules each way, four intervals per axis: every second gridline
  // carries a number. Drift between the two leaves lines with nothing beside
  // them, which is what the reader has to count their way past.
  assert.match(source, /rows = 8,\s*columns = 8,/);
  assert.match(source, /function BubbleChartXAxis\(\{ ticks = 4,/);
  assert.match(source, /function BubbleChartYAxis\(\{ ticks = 4,/);

  // And the domain is rounded to the same four steps, so the numbers on those
  // lines are round ones.
  assert.match(source, /const AXIS_STEPS = 4;/);
  assert.match(source, /niceDomain\(min, max, AXIS_STEPS\)/);
});

test('the grid stroke falls back to something visible in both schemes', () => {
  // A black hairline is invisible on a dark background, so the fallback used
  // when the theme cannot be read has to be neutral.
  const grid = source.slice(source.indexOf('function BubbleChartGrid'));
  assert.match(grid.slice(0, 800), /'rgba\(128,128,128,0\.2\)'/);
  assert.doesNotMatch(grid.slice(0, 800), /'rgba\(0,0,0,0\.1\)'/);
});

test('Trend reports a fit only when the numbers change', () => {
  /*
   * `bubbles` is rebuilt whenever an input changes identity, and a `sizeRange`
   * array literal at a call site is a new array every render — so the fit is a
   * new object every render even when nothing moved. Handed to a caller who
   * puts it in state, that is a render loop, and the caller cannot see it
   * coming. This reached a device once.
   */
  const trend = source.slice(source.indexOf('function BubbleChartTrend'));
  assert.match(trend.slice(0, 4000), /const reported = useRef</);
  assert.match(
    trend.slice(0, 4000),
    /last\.slope === fit\.slope &&\s*last\.intercept === fit\.intercept &&\s*last\.r === fit\.r/
  );
});

test('the parts that need a plot cannot be used without one', () => {
  for (const part of [
    'BubbleChart.Grid',
    'BubbleChart.Quadrants',
    'BubbleChart.Trend',
    'BubbleChart.SizeKey',
  ]) {
    assert.ok(
      source.includes(`useChart('${part}')`),
      `expected ${part} to resolve its geometry through the chart's context`
    );
  }
});

test('a size key needs a size scale, and says so by drawing nothing', () => {
  // Without `sizeKey` every bubble is the middle of the range, so there is no
  // scale to key and a legend of three identical circles would be a lie.
  const key = source.slice(source.indexOf('function BubbleChartSizeKey'));
  assert.match(key.slice(0, 2000), /if \(!sizeExtent\) return null;/);
  assert.match(key.slice(0, 3000), /if \(status === 'loading' \|\| !steps\) return null;/);
});

test('an axis title is reserved for before the plot is laid out', () => {
  // A part that reserved its own room would be positioned against a plot that
  // had already been sized without it.
  assert.match(source, /if \(axis === 'x' && labelled\) xTitle = true;/);
  assert.match(source, /\(axes\.xTitle \? AXIS_TITLE_HEIGHT : 0\)/);
  assert.match(source, /\(axes\.yTitle \? AXIS_TITLE_WIDTH : 0\)/);
});
