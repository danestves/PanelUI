import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accessibilityValueForIndex,
  indexForAccessibilityAction,
} from '../src/components/time-picker/accessibility.ts';

test('adjustable actions move one value in 12- and 24-hour lists', () => {
  assert.equal(indexForAccessibilityAction(4, 12, 'increment'), 5);
  assert.equal(indexForAccessibilityAction(4, 24, 'decrement'), 3);
  assert.equal(indexForAccessibilityAction(0, 2, 'increment'), 1);
});

test('adjustable actions stop at the available bounds', () => {
  assert.equal(indexForAccessibilityAction(0, 12, 'decrement'), undefined);
  assert.equal(indexForAccessibilityAction(23, 24, 'increment'), undefined);
  assert.equal(indexForAccessibilityAction(0, 0, 'increment'), undefined);
});

test('unrelated accessibility actions do not change the value', () => {
  assert.equal(indexForAccessibilityAction(4, 12, 'activate'), undefined);
});

test('disabled adjustable controls ignore actions', () => {
  assert.equal(indexForAccessibilityAction(4, 12, 'increment', true), undefined);
});

test('announced numeric values stay inside the available range', () => {
  assert.deepEqual(accessibilityValueForIndex(4, 12, '5'), {
    min: 0,
    max: 11,
    now: 4,
    text: '5',
  });
  assert.equal(accessibilityValueForIndex(30, 24, '23').now, 23);
});
