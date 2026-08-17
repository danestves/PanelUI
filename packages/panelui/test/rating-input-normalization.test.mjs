import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  normalizeRatingMax,
  normalizeRatingPrecision,
  normalizeRatingValue,
} from '../src/components/rating/rating-inputs.ts';

test('Rating normalizes its structural scale before rendering stars', () => {
  assert.equal(normalizeRatingMax(undefined), 5);
  assert.equal(normalizeRatingMax(Number.NaN), 5);
  assert.equal(normalizeRatingMax(Number.POSITIVE_INFINITY), 5);
  assert.equal(normalizeRatingMax(0), 5);
  assert.equal(normalizeRatingMax(-2), 5);
  assert.equal(normalizeRatingMax(4.9), 4);
  assert.equal(normalizeRatingMax(1), 1);

  assert.equal(normalizeRatingPrecision(undefined), 1);
  assert.equal(normalizeRatingPrecision(0), 1);
  assert.equal(normalizeRatingPrecision(-0.5), 1);
  assert.equal(normalizeRatingPrecision(Number.NaN), 1);
  assert.equal(normalizeRatingPrecision(0.25), 0.25);
});

test('Rating makes non-finite values safely empty and clamps finite values', () => {
  assert.equal(normalizeRatingValue(undefined, 5), 0);
  assert.equal(normalizeRatingValue(Number.NaN, 5), 0);
  assert.equal(normalizeRatingValue(Number.POSITIVE_INFINITY, 5), 0);
  assert.equal(normalizeRatingValue(-1, 5), 0);
  assert.equal(normalizeRatingValue(7, 5), 5);
  assert.equal(normalizeRatingValue(2.5, 5), 2.5);
});

test('render, gesture, and accessibility paths share normalized inputs', async () => {
  const source = await readFile(new URL('../src/components/rating/index.tsx', import.meta.url), 'utf8');

  assert.match(source, /const max = normalizeRatingMax\(maxProp\)/);
  assert.match(source, /const precision = normalizeRatingPrecision\(precisionProp\)/);
  assert.match(source, /const value = normalizeRatingValue\(isControlled \? valueProp : internal, max\)/);
  assert.match(source, /Array\.from\(\{ length: max \}/);
  assert.match(source, /accessibilityValue=\{\{ min: 0, max, now: value, text: shown \}\}/);
});
