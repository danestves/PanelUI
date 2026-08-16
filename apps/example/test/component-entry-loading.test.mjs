import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/data/component-entry-state.ts', import.meta.url),
  'utf8'
);
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { pendingComponentEntry, settleComponentEntry } = await import(
  `data:text/javascript,${encodeURIComponent(javascript)}`
);

test('stale success and failure cannot replace the current slug state', () => {
  const current = pendingComponentEntry('current');
  assert.equal(settleComponentEntry(current, 'stale', { entry: {} }), current);
  assert.equal(settleComponentEntry(current, 'stale', { unavailable: true }), current);
});

test('a current failure settles as unavailable instead of spinning forever', () => {
  assert.deepEqual(
    settleComponentEntry(pendingComponentEntry('current'), 'current', { unavailable: true }),
    { slug: 'current', status: 'unavailable' }
  );
});
