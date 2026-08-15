import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  usePlannerMonthLifecycle,
  usePlannerSelectionLifecycle,
} from '../src/components/planner/planner-lifecycle.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mountHook(useHook, options) {
  let value;
  function Harness({ current }) {
    value = useHook(current);
    return null;
  }

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness, { current: options }));
  });

  return {
    get value() {
      return value;
    },
    async update(current) {
      await act(async () => renderer.update(React.createElement(Harness, { current })));
    },
    async request(next) {
      await act(async () => value[1](next));
    },
    async unmount() {
      await act(async () => renderer.unmount());
    },
  };
}

const settleMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const monthOptions = (month, changes) => ({
  month,
  defaultMonth: new Date(2025, 4, 19),
  settleMonth,
  onMonthChange: (next) => changes.push(next),
});

test('a controlled month changes only after its parent accepts the request', async () => {
  const changes = [];
  const january = new Date(2026, 0, 18);
  const february = new Date(2026, 1, 9);
  const mounted = await mountHook(usePlannerMonthLifecycle, monthOptions(january, changes));

  await mounted.request(february);
  assert.equal(mounted.value[0].getTime(), new Date(2026, 0, 1).getTime());
  assert.deepEqual(changes.map((date) => date.getTime()), [new Date(2026, 1, 1).getTime()]);

  await mounted.update(monthOptions(february, changes));
  assert.equal(mounted.value[0].getTime(), new Date(2026, 1, 1).getTime());

  await mounted.update(monthOptions(january, changes));
  assert.equal(mounted.value[0].getTime(), new Date(2026, 0, 1).getTime());
  assert.equal(changes.length, 1);
  await mounted.unmount();
});

test('an equivalent controlled Date preserves the settled month identity', async () => {
  const changes = [];
  const mounted = await mountHook(
    usePlannerMonthLifecycle,
    monthOptions(new Date(2026, 6, 24), changes)
  );
  const settled = mounted.value[0];

  await mounted.update(monthOptions(new Date(2026, 6, 24), changes));
  assert.equal(mounted.value[0], settled);
  assert.deepEqual(changes, []);
  await mounted.unmount();
});

test('an uncontrolled month commits locally and reports one normalized request', async () => {
  const changes = [];
  const mounted = await mountHook(usePlannerMonthLifecycle, monthOptions(undefined, changes));

  await mounted.request(new Date(2026, 8, 30, 20));
  assert.equal(mounted.value[0].getTime(), new Date(2026, 8, 1).getTime());
  assert.deepEqual(changes.map((date) => date.getTime()), [new Date(2026, 8, 1).getTime()]);
  await mounted.unmount();
});

const selectionOptions = (selected, changes) => ({
  selected,
  defaultSelected: new Date(2025, 4, 19),
  onSelectedChange: (next) => changes.push(next),
});

test('controlled selection supports rejected requests and external resets', async () => {
  const changes = [];
  const first = new Date(2026, 0, 4);
  const requested = new Date(2026, 0, 8);
  const mounted = await mountHook(
    usePlannerSelectionLifecycle,
    selectionOptions(first, changes)
  );

  await mounted.request(requested);
  assert.equal(mounted.value[0], first);
  assert.deepEqual(changes, [requested]);

  await mounted.update(selectionOptions(requested, changes));
  assert.equal(mounted.value[0], requested);
  await mounted.update(selectionOptions(null, changes));
  assert.equal(mounted.value[0], null);
  assert.equal(changes.length, 1);
  await mounted.unmount();
});

test('uncontrolled selection commits child updates including close', async () => {
  const changes = [];
  const next = new Date(2026, 3, 12);
  const mounted = await mountHook(
    usePlannerSelectionLifecycle,
    selectionOptions(undefined, changes)
  );

  await mounted.request(next);
  assert.equal(mounted.value[0], next);
  await mounted.request(null);
  assert.equal(mounted.value[0], null);
  assert.deepEqual(changes, [next, null]);
  await mounted.unmount();
});
