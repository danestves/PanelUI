import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureFocusRestore,
  FocusRestorationStore,
} from '../src/primitives/focus-restoration-store.ts';

test('a closing overlay restores its captured trigger once', () => {
  const store = new FocusRestorationStore();
  let restores = 0;
  const release = store.acquire('dialog', () => {
    restores += 1;
    return true;
  });

  release();
  release();
  assert.equal(restores, 1);
});

test('a nested overlay restores into its open parent before the outer trigger', () => {
  const store = new FocusRestorationStore();
  const restored = [];
  const releaseOuter = store.acquire('dialog', () => restored.push('outer') > 0);
  const releaseInner = store.acquire('popover', () => restored.push('inner') > 0);

  releaseInner();
  assert.deepEqual(restored, ['inner']);
  releaseOuter();
  assert.deepEqual(restored, ['inner', 'outer']);
});

test('a child skips its detached target when its parent closed first', () => {
  const store = new FocusRestorationStore();
  const restored = [];
  const releaseOuter = store.acquire('dialog', () => {
    restored.push('outer');
    return true;
  });
  const releaseInner = store.acquire('popover', () => {
    restored.push('detached-inner');
    return false;
  });

  releaseOuter();
  assert.deepEqual(restored, []);
  releaseInner();
  assert.deepEqual(restored, ['detached-inner', 'outer']);
});

test('browser restoration rejects disconnected and newly disabled triggers', () => {
  const target = {
    isConnected: true,
    disabled: false,
    focus() {
      document.activeElement = this;
    },
  };
  const document = { activeElement: target, body: {}, documentElement: {} };
  const restore = captureFocusRestore(document);

  document.activeElement = document.body;
  target.disabled = true;
  assert.equal(restore(), false);
  target.disabled = false;
  target.isConnected = false;
  assert.equal(restore(), false);
});
