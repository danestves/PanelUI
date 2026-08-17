import assert from 'node:assert/strict';
import test from 'node:test';
import {
  registerPlotSeries,
  unregisterPlotSeries,
  visiblePlotSeries,
} from '../src/components/plot/plot-series-registry.ts';

test('one mark unmounting keeps a shared data series registered', () => {
  let registrations = [];
  registrations = registerPlotSeries(registrations, 'revenue', 'blue');
  registrations = registerPlotSeries(registrations, 'revenue', 'blue');

  registrations = unregisterPlotSeries(registrations, 'revenue', 'blue');
  assert.deepEqual(visiblePlotSeries(registrations), [['revenue', 'blue']]);

  registrations = unregisterPlotSeries(registrations, 'revenue', 'blue');
  assert.deepEqual(visiblePlotSeries(registrations), []);
});

test('removing the latest mark restores the surviving mark color', () => {
  let registrations = registerPlotSeries([], 'orders', 'green');
  registrations = registerPlotSeries(registrations, 'orders', 'orange');
  assert.deepEqual(visiblePlotSeries(registrations), [['orders', 'orange']]);

  registrations = unregisterPlotSeries(registrations, 'orders', 'orange');
  assert.deepEqual(visiblePlotSeries(registrations), [['orders', 'green']]);
});

test('series keys remain structured instead of becoming delimiter-separated data', () => {
  let registrations = registerPlotSeries([], 'north|revenue', 'blue');
  registrations = registerPlotSeries(registrations, '日本|売上', 'red');

  assert.deepEqual(visiblePlotSeries(registrations), [
    ['north|revenue', 'blue'],
    ['日本|売上', 'red'],
  ]);
  assert.equal(unregisterPlotSeries(registrations, 'missing'), registrations);
});
