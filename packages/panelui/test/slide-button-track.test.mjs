import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_THRESHOLD,
  VELOCITY_LOOKAHEAD,
  clamp,
  isCommitted,
  offsetFor,
  progressFor,
  resolveThreshold,
} from '../src/components/slide-button/slide-button-track.ts';

test('a threshold cannot make the button fire on contact', () => {
  assert.equal(resolveThreshold(undefined), DEFAULT_THRESHOLD);
  assert.equal(resolveThreshold(Number.NaN), DEFAULT_THRESHOLD);
  // Zero would complete the moment the thumb moved, which is a button with a
  // gesture in front of it rather than a slide.
  assert.equal(resolveThreshold(0), 0.1);
  assert.equal(resolveThreshold(-4), 0.1);
  // One is allowed: reaching the far end exactly is a legitimate ask.
  assert.equal(resolveThreshold(1), 1);
  assert.equal(resolveThreshold(2), 1);
  assert.equal(resolveThreshold(0.5), 0.5);
});

test('progress is measured against the distance the thumb can cover', () => {
  assert.equal(progressFor(0, 200), 0);
  assert.equal(progressFor(100, 200), 0.5);
  assert.equal(progressFor(200, 200), 1);
  // Past the end and before the start both clamp, so a rubber-banded offset
  // never reports more than a finished slide.
  assert.equal(progressFor(260, 200), 1);
  assert.equal(progressFor(-40, 200), 0);
});

test('progress is zero before the rail has been measured', () => {
  // The first frame runs before layout. Dividing by zero here would put the
  // thumb at NaN, which in Reanimated is a view that never draws again.
  assert.equal(progressFor(50, 0), 0);
  assert.equal(offsetFor(50, 0), 0);
});

test('the thumb follows the finger exactly until the end', () => {
  for (const at of [0, 1, 99, 150, 200]) {
    assert.equal(offsetFor(at, 200), at, `lagging at ${at}`);
  }
});

test('past either end the overshoot is given back at an eighth', () => {
  assert.equal(offsetFor(280, 200), 200 + 80 / 8);
  assert.equal(offsetFor(-80, 200), -10);
});

test('a slide let go at the far end commits', () => {
  assert.equal(isCommitted(1, 0, 200, 0.9), true);
  assert.equal(isCommitted(0.92, 0, 200, 0.9), true);
});

test('a slide let go short and still is refused', () => {
  assert.equal(isCommitted(0.5, 0, 200, 0.9), false);
  assert.equal(isCommitted(0.89, 0, 200, 0.9), false);
});

test('a slide let go short but travelling is honoured', () => {
  // 700 px/s over the lookahead covers 84 px of a 200 px rail — 0.42 — so a
  // flick from just past halfway arrives.
  const carried = (700 * VELOCITY_LOOKAHEAD) / 200;
  assert.ok(carried > 0.4 && carried < 0.45, 'the lookahead has moved');
  assert.equal(isCommitted(0.55, 700, 200, 0.9), true);
  // The same position with the flick going the other way is still refused.
  assert.equal(isCommitted(0.55, -700, 200, 0.9), false);
});

test('nothing commits on an unmeasured rail', () => {
  assert.equal(isCommitted(1, 9000, 0, 0.9), false);
});

test('clamp holds the range', () => {
  assert.equal(clamp(-1, 0, 1), 0);
  assert.equal(clamp(2, 0, 1), 1);
  assert.equal(clamp(0.3, 0, 1), 0.3);
});
