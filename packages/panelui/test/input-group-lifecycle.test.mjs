import assert from 'node:assert/strict';
import test from 'node:test';
import React, { StrictMode } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  useInputGroupDecoratorMeasurement,
  useInputGroupMeasurements,
} from '../src/components/input-group/input-group-measurements.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mountHook(useHook, options, strict = false) {
  let value;
  function Harness({ current }) {
    value = useHook(current);
    return null;
  }
  const render = (current) => {
    const harness = React.createElement(Harness, { current });
    return strict ? React.createElement(StrictMode, null, harness) : harness;
  };

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(render(options));
  });

  return {
    get value() {
      return value;
    },
    async update(current) {
      await act(async () => renderer.update(render(current)));
    },
    async unmount() {
      await act(async () => renderer.unmount());
    },
  };
}

test('unmounting a decorator removes its padding measurement', async () => {
  const mounted = await mountHook(() => useInputGroupMeasurements());
  const prefix = Symbol('prefix');

  await act(async () => mounted.value.measureDecorator('prefix', prefix, 44));
  assert.equal(mounted.value.prefixWidth, 44);

  await act(async () => mounted.value.removeDecorator('prefix', prefix));
  assert.equal(mounted.value.prefixWidth, 0);
  await mounted.unmount();
});

test('an old decorator cannot clear a replacement decorator measurement', async () => {
  const mounted = await mountHook(() => useInputGroupMeasurements());
  const oldPrefix = Symbol('old-prefix');
  const replacement = Symbol('replacement-prefix');

  await act(async () => {
    mounted.value.measureDecorator('prefix', oldPrefix, 52);
    mounted.value.measureDecorator('prefix', replacement, 36);
  });
  assert.equal(mounted.value.prefixWidth, 52);

  await act(async () => mounted.value.removeDecorator('prefix', oldPrefix));
  assert.equal(mounted.value.prefixWidth, 36);

  // A repeated stale cleanup is owner-scoped and leaves the replacement alone.
  await act(async () => mounted.value.removeDecorator('prefix', oldPrefix));
  assert.equal(mounted.value.prefixWidth, 36);
  await mounted.unmount();
});

test('decorator ownership survives effect replay and cleans up on unmount', async () => {
  const first = { measured: [], removed: [] };
  const second = { measured: [], removed: [] };
  const callbacks = (ledger) => ({
    measure: (side, owner, width) => ledger.measured.push({ side, owner, width }),
    remove: (side, owner) => ledger.removed.push({ side, owner }),
  });
  const initial = callbacks(first);
  const mounted = await mountHook(
    ({ measure, remove }) =>
      useInputGroupDecoratorMeasurement('suffix', measure, remove),
    initial,
    true
  );

  await act(async () => mounted.value(28));
  assert.equal(first.measured.at(-1).width, 28);

  const replayed = callbacks(second);
  await mounted.update(replayed);
  assert.equal(first.removed.at(-1).owner, first.measured.at(-1).owner);
  assert.deepEqual(
    { side: second.measured.at(-1).side, width: second.measured.at(-1).width },
    { side: 'suffix', width: 28 }
  );

  await mounted.unmount();
  assert.equal(second.removed.at(-1).owner, second.measured.at(-1).owner);
});
