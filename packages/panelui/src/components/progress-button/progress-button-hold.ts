/**
 * The arithmetic behind a hold, kept out of the component so it can be tested
 * without a renderer — the same split `splitter-math` and `ai-input-growth` use.
 *
 * None of it is worklet-only, so the component can call it from either runtime.
 */

/** Milliseconds a hold has to be sustained before it counts. */
export const DEFAULT_HOLD_DURATION = 2000;

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
