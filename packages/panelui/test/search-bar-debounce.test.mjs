import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cancelSearchBarDebounce,
  flushSearchBarDebounce,
  scheduleSearchBarDebounce,
} from '../src/components/search-bar/search-bar-debounce.ts';

test('submitting flushes one pending query without a later duplicate', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const timer = { current: null };
  const values = [];

  scheduleSearchBarDebounce(timer, (value) => values.push(value), 'panel', 250);
  flushSearchBarDebounce(timer, (value) => values.push(value), 'panel');
  assert.deepEqual(values, ['panel']);
  assert.equal(timer.current, null);

  t.mock.timers.tick(250);
  assert.deepEqual(values, ['panel']);
});

test('rescheduling keeps only the latest query and clears ownership after firing', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const timer = { current: null };
  const values = [];

  scheduleSearchBarDebounce(timer, (value) => values.push(value), 'pan', 250);
  scheduleSearchBarDebounce(timer, (value) => values.push(value), 'panel', 250);
  t.mock.timers.tick(250);

  assert.deepEqual(values, ['panel']);
  assert.equal(timer.current, null);
  cancelSearchBarDebounce(timer);
  assert.equal(timer.current, null);
});

test('non-positive and non-finite delays run immediately without a timer', () => {
  for (const delay of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const timer = { current: null };
    const values = [];
    scheduleSearchBarDebounce(timer, (value) => values.push(value), 'query', delay);
    assert.deepEqual(values, ['query']);
    assert.equal(timer.current, null);
  }
});
