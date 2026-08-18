import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useControllableState } from '../src/primitives/controllable-state.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(options) {
  let result;
  function Harness({ current }) {
    result = useControllableState(current);
    return null;
  }
  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness, { current: options }));
  });
  return {
    get result() { return result; },
    async request(next) { await act(async () => result.setValue(next)); },
    async update(current) {
      await act(async () => renderer.update(React.createElement(Harness, { current })));
    },
    async unmount() { await act(async () => renderer.unmount()); },
  };
}

test('uncontrolled requests normalize, commit, notify, and settle once', async () => {
  const changes = [];
  const settled = [];
  const options = {
    value: undefined,
    defaultValue: 2.8,
    normalize: Math.floor,
    onChange: (value) => changes.push(value),
    onSettled: (value) => settled.push(value),
  };
  const hook = await mount(options);
  assert.equal(hook.result.value, 2);
  await hook.request(4.9);
  await hook.request(4.2);
  await hook.request((current) => current + 2.7);
  assert.equal(hook.result.value, 6);
  assert.deepEqual(changes, [4, 6]);
  assert.deepEqual(settled, [4, 6]);
  await hook.unmount();
});

test('controlled requests stay owner-driven until acceptance and external reset', async () => {
  const changes = [];
  const settled = [];
  const options = (value) => ({
    value,
    defaultValue: 0,
    onChange: (next) => changes.push(next),
    onSettled: (next) => settled.push(next),
  });
  const hook = await mount(options(1));
  await hook.request(2);
  assert.equal(hook.result.value, 1);
  assert.deepEqual(changes, [2]);
  assert.deepEqual(settled, []);

  await hook.update(options(2));
  assert.equal(hook.result.value, 2);
  await hook.update(options(0));
  assert.equal(hook.result.value, 0);
  assert.deepEqual(changes, [2]);
  assert.deepEqual(settled, [2, 0]);
  await hook.unmount();
});

test('semantic keys preserve equivalent controlled object identity', async () => {
  const normalize = (item) => ({ ...item, payload: item.payload + 1 });
  const getValueKey = (item) => item.id;
  const isEqual = (left, right) => left.id === right.id && left.payload === right.payload;
  const options = (value) => ({
    value,
    defaultValue: { id: 'default', payload: 0 },
    normalize,
    getValueKey,
    isEqual,
  });
  const hook = await mount(options({ id: 'owner', payload: 1 }));
  const accepted = hook.result.value;
  await hook.update(options({ id: 'owner', payload: 99 }));
  assert.equal(hook.result.value, accepted);
  assert.deepEqual(hook.result.value, { id: 'owner', payload: 2 });
  await hook.unmount();
});

test('ownership switches retain the latest accepted value instead of a stale default', async () => {
  const options = (value, changes) => ({ value, defaultValue: 1, onChange: (next) => changes.push(next) });
  const changes = [];
  const hook = await mount(options(8, changes));
  await hook.update(options(undefined, changes));
  assert.equal(hook.result.value, 8);
  assert.equal(hook.result.isControlled, false);
  await hook.request(9);
  assert.equal(hook.result.value, 9);
  await hook.update(options(12, changes));
  assert.equal(hook.result.value, 12);
  assert.equal(hook.result.isControlled, true);
  assert.deepEqual(changes, [9]);
  await hook.unmount();
});
