import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateTemplateParity } from '../../../scripts/template-parity.mjs';

const manifest = {
  templates: ['one', 'two'],
  shared: ['shared.txt'],
  overlays: { 'app.json': { differences: ['name'] } },
  unique: { one: ['one.txt'], two: ['two.txt'] },
};

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-template-parity-'));
  for (const template of manifest.templates) fs.mkdirSync(path.join(root, template));
  for (const template of manifest.templates) {
    fs.writeFileSync(path.join(root, template, 'shared.txt'), 'same');
    fs.writeFileSync(path.join(root, template, `${template}.txt`), template);
    fs.writeFileSync(path.join(root, template, 'app.json'), JSON.stringify({ name: template, stable: true }));
  }
  return root;
}

test('the declared parity contract accepts shared files and exact overlays', () => {
  const root = fixture();
  assert.deepEqual(validateTemplateParity(root, manifest), { shared: 1, overlays: 1, unique: 2 });
});

test('shared drift, missing files and extras fail with their paths', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'two', 'shared.txt'), 'drift');
  fs.rmSync(path.join(root, 'one', 'one.txt'));
  fs.writeFileSync(path.join(root, 'two', 'surprise.txt'), 'extra');
  assert.throws(() => validateTemplateParity(root, manifest), /missing one\.txt[\s\S]*unexpected surprise\.txt[\s\S]*shared file drifted: shared\.txt/);
});

test('running a template does not make it fail the contract', () => {
  const root = fixture();
  // Written by `tsc` and by Finder, gitignored, and absent from CI's clean
  // checkout — so counting them as extras only ever fails for a human.
  fs.writeFileSync(path.join(root, 'one', 'expo-env.d.ts'), '/// <reference />');
  fs.writeFileSync(path.join(root, 'two', '.DS_Store'), 'finder');
  fs.mkdirSync(path.join(root, 'one', 'node_modules'));
  fs.writeFileSync(path.join(root, 'one', 'node_modules', 'anything.txt'), 'installed');

  assert.deepEqual(validateTemplateParity(root, manifest), { shared: 1, overlays: 1, unique: 2 });
});

test('overlay differences are exact rather than an unrestricted exception', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'two', 'app.json'), JSON.stringify({ name: 'two', stable: false }));
  assert.throws(() => validateTemplateParity(root, manifest), /app\.json: overlay drifted.*stable/);
});
