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

/*
 * Read from the manifests rather than written down. A parity test with the
 * current version baked into it has to be hand-edited by whoever cuts the
 * release — which is the one person already trusting it to catch what they
 * forgot, and the one moment it would be failing for a reason nobody reads.
 */
const version = (directory) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, directory, 'package.json'), 'utf8')).version;
const LIBRARY = version('packages/panelui');
const CLI = version('packages/cli');
const CREATE = version('packages/create-panelui-app');
const bumpMinor = (semver) => {
  const [major, minor] = semver.split('.');
  return `${major}.${Number(minor) + 1}.0`;
};

test('current manifests, lock, changelog, docs, and workflows agree', () => {
  assert.doesNotThrow(() => checkReleaseParity(ROOT));
  assert.deepEqual(
    [`v${LIBRARY}`, `cli-v${CLI}`, `create-v${CREATE}`].map((tag) => {
      const target = releaseTarget(tag);
      return [target?.name, target?.version, target?.tagPrefix];
    }),
    [
      ['panelui-native', LIBRARY, 'v'],
      ['panelui-cli', CLI, 'cli-v'],
      ['create-panelui-app', CREATE, 'create-v'],
    ],
  );
  assert.equal(releaseTarget('docs-v1.0.0'), null);
  assert.equal(releaseTarget('vnot-a-version'), null);
});

test('a future manifest bump identifies every release artifact to update', () => {
  const files = fixture();
  const next = bumpMinor(LIBRARY);
  const manifest = JSON.parse(files.get('packages/panelui/package.json'));
  manifest.version = next;
  files.set('packages/panelui/package.json', JSON.stringify(manifest));

  const errors = validateReleaseParity((file) => files.get(file));
  assert.ok(errors.some((error) => error.includes(`manifest is ${next}`)));
  assert.ok(errors.some((error) => error.includes(`panelui-native ${next} row`)));
  assert.ok(errors.some((error) => error.includes(`current release is ${LIBRARY}`)));
});

test('seeded lock, docs, changelog, and tag drift is aggregated', () => {
  const files = fixture();
  const stale = '0.0.1';
  const lock = JSON.parse(files.get('package-lock.json'));
  lock.packages['packages/panelui'].version = stale;
  files.set('package-lock.json', JSON.stringify(lock));
  files.set(
    'apps/docs/content/docs/upgrading.mdx',
    files.get('apps/docs/content/docs/upgrading.mdx').replaceAll(CLI, '0.4.9'),
  );
  files.set(
    'CHANGELOG.md',
    files.get('CHANGELOG.md').replace(`## [${LIBRARY}]`, `## [${stale}]`),
  );
  files.set(
    '.github/workflows/publish-cli.yml',
    files.get('.github/workflows/publish-cli.yml').replace('cli-v*)', 'tool-v*)'),
  );

  const errors = validateReleaseParity((file) => files.get(file));
  assert.ok(errors.some((error) => error.includes(`packages/panelui is ${stale}`)));
  assert.ok(errors.some((error) => error.includes(`panelui-cli ${CLI} row`)));
  assert.ok(errors.some((error) => error.includes(`current release is ${stale}`)));
  assert.ok(errors.some((error) => error.includes('CLI tag parser')));
});
