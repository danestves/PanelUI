import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkReleaseParity,
  releaseTarget,
  validateReleaseParity,
} from '../scripts/release-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'package-lock.json',
  'CHANGELOG.md',
  'apps/docs/content/docs/upgrading.mdx',
  '.github/workflows/ci.yml',
  '.github/workflows/publish.yml',
  '.github/workflows/publish-cli.yml',
  '.github/workflows/deploy-docs.yml',
  'packages/panelui/package.json',
  'packages/cli/package.json',
  'packages/create-panelui-app/package.json',
];

function fixture() {
  return new Map(
    FILES.map((file) => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')]),
  );
}

test('current manifests, lock, changelog, docs, and workflows agree', () => {
  assert.doesNotThrow(() => checkReleaseParity(ROOT));
  assert.deepEqual(
    ['v0.68.0', 'cli-v0.5.0', 'create-v0.2.1'].map((tag) => {
      const target = releaseTarget(tag);
      return [target?.name, target?.version, target?.tagPrefix];
    }),
    [
      ['panelui-native', '0.68.0', 'v'],
      ['panelui-cli', '0.5.0', 'cli-v'],
      ['create-panelui-app', '0.2.1', 'create-v'],
    ],
  );
  assert.equal(releaseTarget('docs-v1.0.0'), null);
  assert.equal(releaseTarget('vnot-a-version'), null);
});

test('a future manifest bump identifies every release artifact to update', () => {
  const files = fixture();
  const manifest = JSON.parse(files.get('packages/panelui/package.json'));
  manifest.version = '0.69.0';
  files.set('packages/panelui/package.json', JSON.stringify(manifest));

  const errors = validateReleaseParity((file) => files.get(file));
  assert.ok(errors.some((error) => error.includes('manifest is 0.69.0')));
  assert.ok(errors.some((error) => error.includes('panelui-native 0.69.0 row')));
  assert.ok(errors.some((error) => error.includes('current release is 0.68.0')));
});

test('seeded lock, docs, changelog, and tag drift is aggregated', () => {
  const files = fixture();
  const lock = JSON.parse(files.get('package-lock.json'));
  lock.packages['packages/panelui'].version = '0.67.0';
  files.set('package-lock.json', JSON.stringify(lock));
  files.set(
    'apps/docs/content/docs/upgrading.mdx',
    files.get('apps/docs/content/docs/upgrading.mdx').replaceAll('0.5.0', '0.4.9'),
  );
  files.set('CHANGELOG.md', files.get('CHANGELOG.md').replace('## [0.68.0]', '## [0.67.0]'));
  files.set(
    '.github/workflows/publish-cli.yml',
    files.get('.github/workflows/publish-cli.yml').replace('cli-v*)', 'tool-v*)'),
  );

  const errors = validateReleaseParity((file) => files.get(file));
  assert.ok(errors.some((error) => error.includes('packages/panelui is 0.67.0')));
  assert.ok(errors.some((error) => error.includes('panelui-cli 0.5.0 row')));
  assert.ok(errors.some((error) => error.includes('current release is 0.67.0')));
  assert.ok(errors.some((error) => error.includes('CLI tag parser')));
});
