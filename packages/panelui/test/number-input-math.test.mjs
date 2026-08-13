import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(
  new URL('../src/components/number-input/number-input-math.ts', import.meta.url),
  'utf8'
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { normalize, precisionOf } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);

test('precisionOf reads decimal and scientific step forms', () => {
  assert.equal(precisionOf(1), 0);
  assert.equal(precisionOf(0.125), 3);
  assert.equal(precisionOf(1e-7), 7);
  assert.equal(precisionOf(-1e-7), 7);
  assert.equal(precisionOf(1.25e-7), 9);
  assert.equal(precisionOf(1e7), 0);
  assert.equal(precisionOf(1.25e3), 0);
  assert.equal(precisionOf(1.25e21), 0);
  assert.equal(precisionOf(1e-20), 15);
  assert.equal(precisionOf(Number.NaN), 0);
  assert.equal(precisionOf(Infinity), 0);
});

test('normalize keeps scientific steps, bounds, and decimal rounding', () => {
  assert.equal(normalize(2e-7, -Infinity, Infinity, 1e-7), 2e-7);
  assert.equal(normalize(2.6e-7, -Infinity, Infinity, 1e-7), 3e-7);
  assert.equal(normalize(-2.6e-7, -Infinity, Infinity, 1e-7), -3e-7);
  assert.equal(normalize(2.7e-7, 5e-8, 1, 1e-7), 3e-7);
  assert.equal(normalize(12349, -Infinity, Infinity, 1e3), 12000);
  assert.equal(normalize(0.30000000000000004, 0, 1, 0.1), 0.3);
  assert.equal(normalize(1.2, 0, 1, 0.1), 1);
  assert.equal(normalize(1e300, -Infinity, Infinity, 1e-7), 1e300);
});
