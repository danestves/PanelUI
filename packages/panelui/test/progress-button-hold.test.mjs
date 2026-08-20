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
  fillDuration,
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

test('the release is the fill played backwards, at the fill\'s own rate', () => {
  // Whatever the hold was, giving it back covers the distance left at exactly
  // the rate it was earned at: half a 3000ms hold takes 1500ms to travel home.
  for (const hold of [600, 2000, 3500]) {
    assert.equal(releaseDuration(1, hold), hold);
    assert.equal(releaseDuration(0.5, hold), hold / 2);
    assert.equal(releaseDuration(0.9, hold), hold * 0.9);
  }
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

test('the fill and the release are one animation in two directions', () => {
  const hold = 2000;
  // Whatever the split, going out and coming back cover the same ground at the
  // same rate: a fill picked up at 0.3 has 0.7 to travel, and released there
  // has 0.3 to travel home.
  for (const at of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    assert.equal(fillDuration(at, hold) + releaseDuration(at, hold), hold);
  }
  assert.equal(fillDuration(0, hold), hold);
  assert.equal(releaseDuration(1, hold), hold);
});

test('a press that catches the fill on its way back does not restart the clock', () => {
  // The distance left, not the whole hold — otherwise the second attempt is
  // slower than the first for no reason the reader can see.
  assert.equal(fillDuration(0.5, 2000), 1000);
  assert.ok(fillDuration(0.9, 2000) < fillDuration(0.1, 2000));
  assert.ok(fillDuration(1, 2000) >= 80);
  assert.ok(fillDuration(-1, 2000) <= 2000);
});

test('the release is started where the value actually lives', async () => {
  const source = await readFile(
    new URL('../src/components/progress-button/index.tsx', import.meta.url),
    'utf8'
  );

  /*
   * A shared value animated on the UI thread does not report back to
   * JavaScript, so `progress.value` read from a press handler is the value
   * from before the hold began. Computing the release from it made the fill
   * vanish on touch-up instead of travelling home — silently, and with nothing
   * in the types to say so.
   */
  assert.match(source, /runOnUI\(\(\) => \{\s*'worklet';\s*cancelAnimation\(progress\);\s*const from = progress\.value;\s*if \(from <= 0\) return;/);
  assert.match(source, /duration: releaseDuration\(from, duration\)/);
  assert.match(source, /duration: fillDuration\(from, duration\)/);
});

test('the release default is the hold default, not a number of its own', () => {
  // Two constants that have to stay equal is one constant. The component
  // passes the resolved hold duration anyway; this is only the fallback.
  assert.equal(DEFAULT_RELEASE_DURATION, DEFAULT_HOLD_DURATION);
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
