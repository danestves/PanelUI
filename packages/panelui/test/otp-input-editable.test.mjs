import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { resolveOtpEditable } from '../src/components/otp-input/otp-input-state.ts';

test('disabled always wins over the native editable escape hatch', () => {
  assert.equal(resolveOtpEditable(undefined, undefined), true);
  assert.equal(resolveOtpEditable(false, false), false);
  assert.equal(resolveOtpEditable(true, false), true);
  assert.equal(resolveOtpEditable(false, true), false);
  assert.equal(resolveOtpEditable(true, true), false);
});

test('OtpInput resolves the forwarded editable prop with its disabled state', () => {
  const source = readFileSync(
    new URL('../src/components/otp-input/index.tsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /disabled,\s+editable,/);
  assert.match(source, /editable=\{resolveOtpEditable\(editable, disabled\)\}/);

  const registry = JSON.parse(
    readFileSync(
      new URL('../../../apps/docs/public/r/otp-input.json', import.meta.url),
      'utf8'
    )
  );
  const copiedState = registry.files.find(
    (file) => file.path === 'ui/otp-input-state.ts'
  );
  assert.ok(copiedState, 'registry must ship the editable-state helper');
  assert.match(copiedState.content, /editable !== false && !disabled/);
});
