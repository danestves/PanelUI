import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { inputContentPadding } from '../src/components/input/input-content-padding.ts';

test('Input applies measured padding only while that content is mounted', () => {
  assert.equal(inputContentPadding(48, true), 48);
  assert.equal(inputContentPadding(48, false), undefined);
  assert.equal(inputContentPadding(0, true), undefined);
  assert.equal(inputContentPadding(Number.NaN, true), undefined);
});

test('both logical sides gate stale measurements on current content', async () => {
  const source = await readFile(new URL('../src/components/input/index.tsx', import.meta.url), 'utf8');

  assert.match(source, /inputContentPadding\(startWidth, !!startContent\)/);
  assert.match(source, /inputContentPadding\(endWidth, !!endContent\)/);
  assert.match(source, /startPadding \? \{ paddingStart: startPadding \} : null/);
  assert.match(source, /endPadding \? \{ paddingEnd: endPadding \} : null/);
});
