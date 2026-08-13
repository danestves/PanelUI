import assert from 'node:assert/strict';
import test from 'node:test';
import { ModalIsolationStore } from '../src/primitives/modal-isolation-store.ts';

test('the first modal isolates the app and the last release restores it', () => {
  const store = new ModalIsolationStore();
  const snapshots = [];
  store.subscribe(() => snapshots.push(store.getSnapshot()));

  const release = store.acquire('dialog');
  assert.equal(store.getSnapshot(), true);
  release();

  assert.equal(store.getSnapshot(), false);
  assert.deepEqual(snapshots, [true, false]);
});

test('closing one nested modal keeps the app isolated for the other', () => {
  const store = new ModalIsolationStore();
  const snapshots = [];
  store.subscribe(() => snapshots.push(store.getSnapshot()));

  const releaseDialog = store.acquire('dialog');
  const releaseDrawer = store.acquire('drawer');
  releaseDialog();

  assert.equal(store.getSnapshot(), true);
  assert.deepEqual(snapshots, [true]);

  releaseDrawer();
  assert.equal(store.getSnapshot(), false);
  assert.deepEqual(snapshots, [true, false]);
});

test('an unmount cleanup is idempotent', () => {
  const store = new ModalIsolationStore();
  const release = store.acquire('sheet');

  release();
  release();

  assert.equal(store.getSnapshot(), false);
});
