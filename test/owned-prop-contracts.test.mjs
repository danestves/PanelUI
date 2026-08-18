import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateOwnedPropContracts } from '../scripts/owned-prop-contracts.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('inventoried compound controls protect owned props after consumer spreads', () => {
  assert.deepEqual(validateOwnedPropContracts({ root }), []);
});

test('owned prop contracts reject replacement, omission, and ambiguous targets', (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-owned-props-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const relative = 'control.tsx';
  const absolute = path.join(fixture, relative);
  const contract = [{ owner: 'Control', file: relative, element: 'Pressable', props: ['disabled', 'onPress'] }];
  fs.writeFileSync(absolute, `
    const Control = forwardRef(({ ...props }, ref) => (
      <Pressable disabled {...props} onPress={() => {}} />
    ));
  `);
  let errors = validateOwnedPropContracts({ root: fixture, contracts: contract });
  assert.ok(errors.some((error) => error.includes('consumer props can replace disabled')));

  fs.writeFileSync(absolute, `
    const Control = forwardRef(({ ...props }, ref) => (<>
      <Pressable {...props} disabled />
      <Pressable {...props} disabled onPress={() => {}} />
    </>));
  `);
  errors = validateOwnedPropContracts({ root: fixture, contracts: contract });
  assert.ok(errors.some((error) => error.includes('expected one Pressable')));
});
