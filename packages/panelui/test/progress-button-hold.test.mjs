/**
 * The rules a hold-to-confirm control cannot get wrong.
 *
 * Two of these are safety properties rather than preferences. A hold that can
 * complete without being sustained is a confirmation that confirms by accident,
 * which is worse than no confirmation at all — the reader believes they are
 * protected. And a hold that fires on anything short of a full fill commits
 * after the reader has deliberately let go.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DEFAULT_AUTO_RESET_DELAY,
  DEFAULT_HOLD_DURATION,
  DEFAULT_RELEASE_DURATION,
  isComplete,
  releaseDuration,
  resolveHoldDuration,
} from '../src/components/progress-button/progress-button-hold.ts';

test('a hold cannot be made instant', () => {
  // Zero would complete on touch-down, which is a button with extra steps.
  assert.equal(resolveHoldDuration(0), 200);
  assert.equal(resolveHoldDuration(-1000), 200);
  assert.equal(resolveHoldDuration(50), 200);
  assert.equal(resolveHoldDuration(2500), 2500);
});

test('an unusable hold duration falls back rather than producing one', () => {
  assert.equal(resolveHoldDuration(undefined), DEFAULT_HOLD_DURATION);
  assert.equal(resolveHoldDuration(Number.NaN), DEFAULT_HOLD_DURATION);
  assert.equal(resolveHoldDuration(Number.POSITIVE_INFINITY), DEFAULT_HOLD_DURATION);
});

test('only a full fill counts as a confirmation', () => {
  assert.equal(isComplete(1), true);
  assert.equal(isComplete(1.0001), true);
  // No tolerance near the top. A tolerance means the button sometimes fires
  // after the reader let go on purpose.
  assert.equal(isComplete(0.999), false);
  assert.equal(isComplete(0.5), false);
  assert.equal(isComplete(0), false);
});

test('the fill drains in proportion to how far it got', () => {
  const far = releaseDuration(1);
  const near = releaseDuration(0.1);
  assert.equal(far, DEFAULT_RELEASE_DURATION);
  assert.ok(near < far, 'a barely-started hold should not take a full release');
  // Never instant, or an abandoned hold reads as the fill being deleted rather
  // than let go.
  assert.ok(releaseDuration(0) >= 80);
  assert.ok(releaseDuration(0.001) >= 80);
});

test('out-of-range progress cannot produce a negative or unbounded release', () => {
  assert.ok(Number.isFinite(releaseDuration(-1)));
  assert.ok(releaseDuration(-1) >= 80);
  assert.equal(releaseDuration(4), DEFAULT_RELEASE_DURATION);
});

test('completion is read off the animation, not timed beside it', async () => {
  const source = await readFile(
    new URL('../src/components/progress-button/index.tsx', import.meta.url),
    'utf8'
  );

  /*
   * A `setTimeout` for the hold and a fill for the hold are two clocks that
   * agree only while the app is idle. Busy, the button fires before the fill
   * arrives — a confirmation that happened earlier than the reader watched it
   * happen.
   */
  assert.match(source, /useAnimatedReaction\(/);
  assert.match(source, /progress\.value >= 1/);
  assert.doesNotMatch(
    source,
    /setTimeout\([^)]*\bfinish\b/,
    'completion must not be scheduled on a JS timer'
  );
});

test('the auto-reset delay is a real default', () => {
  assert.ok(Number.isFinite(DEFAULT_AUTO_RESET_DELAY));
  assert.ok(DEFAULT_AUTO_RESET_DELAY > 0);
});
