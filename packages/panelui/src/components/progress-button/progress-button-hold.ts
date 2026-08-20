/**
 * The arithmetic behind a hold, kept out of the component so it can be tested
 * without a renderer — the same split `splitter-math` and `ai-input-growth` use.
 *
 * None of it is worklet-only, so the component can call it from either runtime.
 */

/** Milliseconds a hold has to be sustained before it counts. */
export const DEFAULT_HOLD_DURATION = 2000;

/**
 * Milliseconds a complete fill takes to rewind, when the hold length is not
 * known — the default only exists so {@link releaseDuration} has one.
 *
 * The component always passes the hold's own duration instead: the drain is
 * the fill running backwards at the same rate, so a two-second hold takes two
 * seconds to give back.
 */
export const DEFAULT_RELEASE_DURATION = DEFAULT_HOLD_DURATION;

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
 * The fill, run backwards. `full` is the hold's own duration, so the drain
 * covers the distance left at exactly the rate it was filled at: let go at
 * nine tenths of a two-second hold and it takes 1.8 seconds to give back, the
 * same 1.8 seconds it took to earn.
 *
 * That is the point of it. The wait was drawn on the button, so undoing the
 * wait is worth drawing too — a fill that vanishes has been deleted, and a
 * fill that travels back has been let go.
 */
export function releaseDuration(
  progress: number,
  full: number = DEFAULT_RELEASE_DURATION
): number {
  // A worklet, because the only runtime that knows how far the fill actually
  // got is the one animating it. Reading a shared value from JavaScript gives
  // the value before the animation started, so the release has to be started
  // from the UI thread — and that means this has to run there too.
  'worklet';
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
  'worklet';
  return progress >= 1;
}

/**
 * How long it takes to cover the distance still ahead, at the fill's own rate.
 *
 * A press that arrives while the fill is on its way back should carry on from
 * where it is rather than restarting the clock — otherwise a fill picked up at
 * halfway takes the whole hold to cover the half that is left, and the second
 * attempt is twice as slow as the first for no reason the reader can see.
 */
export function fillDuration(from: number, full: number): number {
  'worklet';
  const remaining = Math.min(1, Math.max(0, 1 - from));
  return Math.max(80, full * remaining);
}
