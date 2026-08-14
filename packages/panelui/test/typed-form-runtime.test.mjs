import assert from 'node:assert/strict';
import test from 'node:test';
import { bindFormRuntime } from '../src/components/form/typed-form.ts';

test('typed form binding reuses the compatibility runtime and hooks', () => {
  const root = () => 'root';
  const field = () => 'field';
  const useForm = () => 'form';
  const useField = () => 'field state';
  const bound = bindFormRuntime(root, field, useForm, useField);

  assert.equal(bound, root);
  assert.equal(bound.Field, field);
  assert.equal(bound.useForm, useForm);
  assert.equal(bound.useField, useField);
});
