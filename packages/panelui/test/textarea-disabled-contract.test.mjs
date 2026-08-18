import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { textareaIsDisabled } from '../src/components/textarea/textarea-disabled.ts';

test('Textarea cannot be re-enabled through the inherited editable prop', () => {
  assert.equal(textareaIsDisabled(true, true), true);
  assert.equal(textareaIsDisabled(true, false), true);
  assert.equal(textareaIsDisabled(false, false), true);
  assert.equal(textareaIsDisabled(false, true), false);
  assert.equal(textareaIsDisabled(undefined, undefined), false);
});

test('the effective disabled state owns behavior, styling, label, and semantics', async () => {
  const source = await readFile(
    new URL('../src/components/textarea/index.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /const isDisabled = textareaIsDisabled\(disabled, editable\)/);
  assert.match(source, /disabled: isDisabled/);
  assert.match(source, /isDisabled={isDisabled}/);
  assert.match(source, /editable={!isDisabled}/);
  assert.match(source, /accessibilityState={{ \.\.\.accessibilityState, disabled: isDisabled }}/);
  assert.doesNotMatch(source, /editable={!disabled}/);
});
