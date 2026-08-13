import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useForm } from '../src/components/form/use-form.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function mountForm(options) {
  let current;

  function Harness() {
    current = useForm(options);
    return null;
  }

  let renderer;
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Harness));
  });

  return {
    get form() {
      return current;
    },
    async unmount() {
      await act(async () => renderer.unmount());
    },
  };
}

test('latest field validation owns the committed error', async () => {
  const older = deferred();
  const newer = deferred();
  let calls = 0;
  const mounted = await mountForm({
    defaultValues: { email: 'old@example.com' },
    onSubmit() {},
  });

  mounted.form.registerValidator('email', () => (calls++ === 0 ? older.promise : newer.promise));
  const olderResult = mounted.form.validateField('email');
  act(() => mounted.form.setFieldValue('email', 'new@example.com'));
  const newerResult = mounted.form.validateField('email');

  await act(async () => {
    newer.resolve(undefined);
    await newerResult;
  });
  assert.equal(mounted.form.errors.email, undefined);

  await act(async () => {
    older.resolve('This error belongs to the old value.');
    await olderResult;
  });
  assert.equal(mounted.form.errors.email, undefined);
  await mounted.unmount();
});

test('changing a field invalidates its pending validation', async () => {
  const validation = deferred();
  const mounted = await mountForm({
    defaultValues: { email: 'old@example.com' },
    onSubmit() {},
  });

  mounted.form.registerValidator('email', () => validation.promise);
  const result = mounted.form.validateField('email');
  act(() => mounted.form.setFieldValue('email', 'new@example.com'));

  await act(async () => {
    validation.resolve('This error belongs to the old value.');
    await result;
  });

  assert.equal(mounted.form.errors.email, undefined);
  await mounted.unmount();
});

test('concurrent submissions invoke onSubmit once and release the lock afterward', async () => {
  const firstGate = deferred();
  const secondGate = deferred();
  const gates = [firstGate, secondGate];
  let submissions = 0;
  const mounted = await mountForm({
    defaultValues: { email: 'valid@example.com' },
    async onSubmit() {
      const gate = gates[submissions++];
      assert.ok(gate);
      await gate.promise;
    },
  });

  let first;
  let duplicate;
  await act(async () => {
    first = mounted.form.handleSubmit();
    duplicate = mounted.form.handleSubmit();
    await Promise.resolve();
  });

  assert.equal(submissions, 1);
  assert.equal(mounted.form.isSubmitting, true);

  await act(async () => {
    firstGate.resolve();
    await Promise.all([first, duplicate]);
  });
  assert.equal(mounted.form.isSubmitting, false);

  let second;
  await act(async () => {
    second = mounted.form.handleSubmit();
    await Promise.resolve();
  });
  assert.equal(submissions, 2);
  secondGate.resolve();
  await act(async () => second);
  await mounted.unmount();
});

test('failed validation releases the submission lock', async () => {
  let error = 'Required';
  let submissions = 0;
  const mounted = await mountForm({
    defaultValues: { email: '' },
    onSubmit() {
      submissions++;
    },
  });
  mounted.form.registerValidator('email', () => error);

  await act(async () => mounted.form.handleSubmit());
  assert.equal(submissions, 0);

  error = undefined;
  act(() => mounted.form.setFieldValue('email', 'valid@example.com'));
  await act(async () => mounted.form.handleSubmit());
  assert.equal(submissions, 1);
  await mounted.unmount();
});
