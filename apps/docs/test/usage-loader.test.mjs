import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadUsage } from '../scripts/load-usage.mjs';

function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'panelui-usage-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [name, value] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), typeof value === 'string' ? value : JSON.stringify(value));
  }
  return root;
}

test('loads modules in metadata order without retaining their envelopes', (t) => {
  const root = fixture(t, {
    'beta.json': { slug: 'beta', intro: 'B' },
    'alpha.json': { slug: 'alpha', intro: 'A' },
  });

  assert.deepEqual(loadUsage(root, ['alpha', 'beta']), {
    alpha: { intro: 'A' },
    beta: { intro: 'B' },
  });
});

test('rejects duplicate, missing, unknown, and non-JSON modules together', (t) => {
  const root = fixture(t, {
    'alpha.json': { slug: 'alpha' },
    'alpha-copy.json': { slug: 'alpha' },
    'unknown.json': { slug: 'unknown' },
    'notes.md': 'not a module',
  });

  let error;
  try {
    loadUsage(root, ['alpha', 'missing']);
  } catch (caught) {
    error = caught;
  }
  assert.ok(error instanceof Error);
  assert.match(error.message, /duplicate slug alpha/);
  assert.match(error.message, /unknown slug unknown/);
  assert.match(error.message, /unexpected artifact: notes\.md/);
  assert.match(error.message, /missing usage module: missing\.json/);
});

test('ignores the files the platform leaves behind', (t) => {
  const root = fixture(t, {
    'alpha.json': { slug: 'alpha', intro: 'A' },
    '.DS_Store': 'finder',
    '.gitkeep': '',
  });

  assert.deepEqual(loadUsage(root, ['alpha']), { alpha: { intro: 'A' } });
});

test('rejects malformed JSON, invalid envelopes, and bad filenames', (t) => {
  const root = fixture(t, {
    'broken.json': '{',
    'empty.json': [],
    'renamed.json': { slug: 'valid' },
  });

  assert.throws(
    () => loadUsage(root, ['valid']),
    /invalid JSON[\s\S]*usage module must be an object[\s\S]*filename must match slug valid/
  );
});
