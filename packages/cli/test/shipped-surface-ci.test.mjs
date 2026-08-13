import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const workflow = fs.readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));

test('CI owns docs production build and packed CLI smoke commands', () => {
  assert.match(workflow, /name: Build documentation[\s\S]*npm run build --workspace=docs/);
  assert.match(workflow, /name: Verify packed CLI consumers[\s\S]*npm run verify:cli-packages/);
  assert.equal(pkg.scripts['verify:cli-packages'], 'node scripts/verify-cli-packages.mjs');
  assert.ok(fs.existsSync(`${root}/scripts/verify-cli-packages.mjs`));
});

test('Node 20 compatibility job owns the supported CLI boundary', () => {
  assert.match(workflow, /node20-compatibility:[\s\S]*node-version: 20/);
  assert.match(workflow, /node20-compatibility:[\s\S]*npm run test:cli/);
  assert.match(workflow, /node20-compatibility:[\s\S]*npm run verify:cli-packages/);
  assert.equal(pkg.scripts['test:cli'], 'node --test packages/cli/test/*.test.mjs');
});
