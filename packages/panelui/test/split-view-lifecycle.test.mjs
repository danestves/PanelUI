import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useSplitViewIndexLifecycle } from '../src/components/split-view/split-view-lifecycle.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(options) {
  let value;
  function Harness({ current }) {
    value = useSplitViewIndexLifecycle(current);
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
    async request(index) {
      await act(async () => value.requestIndex(index));
    },
    async unmount() {
      await act(async () => renderer.unmount());
    },
  };
}

const options = (overrides = {}) => ({
  snapIndex: undefined,
  defaultSnapIndex: 1,
  count: 0,
  ...overrides,
});

test('the requested default survives until the measured point count is known', async () => {
  const mounted = await mount(options());
  assert.equal(mounted.value.index, 0);

  await mounted.update(options({ count: 3 }));
  assert.equal(mounted.value.index, 1);
  await mounted.unmount();
});

test('a rejected controlled request remains owner-driven and asks to resettle', async () => {
  const changes = [];
  const mounted = await mount(
    options({
      snapIndex: 1,
      count: 3,
      onSnapIndexChange: (index) => changes.push(index),
    })
  );
  const token = mounted.value.requestToken;

  await mounted.request(2);
  assert.equal(mounted.value.index, 1);
  assert.equal(mounted.value.requestToken, token + 1);
  assert.deepEqual(changes, [2]);

  await mounted.update(options({ snapIndex: 2, count: 3 }));
  assert.equal(mounted.value.index, 2);
  await mounted.unmount();
});

test('an uncontrolled request commits locally and reports once', async () => {
  const changes = [];
  const mounted = await mount(
    options({ count: 3, onSnapIndexChange: (index) => changes.push(index) })
  );

  await mounted.request(2);
  assert.equal(mounted.value.index, 2);
  assert.deepEqual(changes, [2]);
  await mounted.unmount();
});
