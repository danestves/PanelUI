/**
 * The arithmetic behind a hold, kept out of the component so it can be tested
 * without a renderer — the same split `splitter-math` and `ai-input-growth` use.
 *
 * None of it is worklet-only, so the component can call it from either runtime.
 */

/** Milliseconds a hold has to be sustained before it counts. */
export const DEFAULT_HOLD_DURATION = 2000;

/**
 * The longest a full fill takes to rewind, and the shortest.
 *
 * The drain is the fill run backwards rather than a snap, so it is derived from
 * the hold rather than fixed: a three-second hold that empties in a quarter of
 * a second reads as the button discarding the wait, and the reader watching it
 * go is what tells them nothing was confirmed. Faster than the fill, because it
 * is undoing rather than reporting — see {@link rewindDuration}.
 */
export const MIN_REWIND_DURATION = 200;
export const MAX_REWIND_DURATION = 700;

/** What fraction of the hold a complete rewind takes. */
export const REWIND_FRACTION = 0.4;

/** Milliseconds the fill takes to drain when a hold is abandoned. */
export const DEFAULT_RELEASE_DURATION = 240;

/** Milliseconds before an `autoReset` button offers itself again. */
export const DEFAULT_AUTO_RESET_DELAY = 1000;

/**
 * A hold duration that cannot produce a broken animation.
 *
 * Zero would complete on touch-down, which defeats the point of the control:
 * a hold-to-confirm that confirms on a tap is a button with extra steps. A
 * floor rather than a rejection, because the caller asking for `0` wants it
 * fast, not broken.
 */
export function resolveHoldDuration(duration: number | undefined): number {
  if (duration === undefined) return DEFAULT_HOLD_DURATION;
  if (!Number.isFinite(duration)) return DEFAULT_HOLD_DURATION;
  return Math.max(200, duration);
}

/**
 * How long the fill should take to drain from where it is.
 *
 * Proportional to how far it got, so abandoning a hold at a tenth of the way
 * does not take the same quarter-second as abandoning it at nine tenths. A
 * fixed release makes a barely-started hold feel sticky, which reads as the
 * control resisting being let go.
 */
export function releaseDuration(
  progress: number,
  full: number = DEFAULT_RELEASE_DURATION
): number {
  const travelled = Math.min(1, Math.max(0, progress));
  return Math.max(80, full * travelled);
}

/**
 * How long a complete rewind takes, for a hold of a given length.
 *
 * Scaled to the hold so the drain is recognisably the same motion in reverse,
 * and clamped at both ends: a 200ms hold should not empty in 80ms, which is a
 * flicker, and a ten-second one should not take four seconds to give up, which
 * is the reader waiting for the button to finish disagreeing with them.
 */
export function rewindDuration(holdDuration: number): number {
  const scaled = holdDuration * REWIND_FRACTION;
  return Math.min(MAX_REWIND_DURATION, Math.max(MIN_REWIND_DURATION, scaled));
}

/**
 * Whether a hold that has been released should still be honoured.
 *
 * The fill is the promise, so anything short of the end is not a confirmation —
 * there is no "close enough" here. It exists as a named function because the
 * tempting version of this rule is a tolerance, and a tolerance means the
 * button sometimes fires when the reader let go early on purpose.
 */
export function isComplete(progress: number): boolean {
  return progress >= 1;
}
