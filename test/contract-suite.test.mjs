import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  discoverContractTests,
  findFocusedTests,
} from '../scripts/run-contract-tests.mjs';

async function fixture(files) {
  const root = await mkdtemp(join(tmpdir(), 'panelui-contracts-'));
  await Promise.all(Object.entries(files).map(async ([path, source]) => {
    const target = join(root, path);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, source);
  }));
  return root;
}

test('discovery covers root, package, app, and future workspace tests', async () => {
  const root = await fixture({
    'test/root.test.mjs': 'test("root", () => {})',
    'packages/a/test/package.test.mjs': 'test("package", () => {})',
    'apps/a/test/app.test.mjs': 'test("app", () => {})',
    'future/a/test/future.test.mjs': 'test("future", () => {})',
    'node_modules/no/test/ignored.test.mjs': 'test("ignored", () => {})',
    'packages/a/test/not-a-spec.mjs': '',
  });
  assert.deepEqual(await discoverContractTests(root), [
    'apps/a/test/app.test.mjs',
    'future/a/test/future.test.mjs',
    'packages/a/test/package.test.mjs',
    'test/root.test.mjs',
  ]);
});

test('focused test detection rejects test, it, and describe only', async () => {
  const focusedCall = ['describe', '.only'].join('');
  const root = await fixture({
    'test/clean.test.mjs': 'test("clean", () => {})',
    'test/focused.test.mjs': `${focusedCall}("focused", () => {})`,
  });
  const files = await discoverContractTests(root);
  assert.deepEqual(await findFocusedTests(files, root), ['test/focused.test.mjs']);
});
