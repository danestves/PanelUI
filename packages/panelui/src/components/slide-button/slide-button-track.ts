/**
 * The arithmetic behind a slide, kept out of the component so it can be tested
 * without a renderer — the same split `progress-button-hold` uses.
 *
 * The gesture's worklets carry their own copies of these three lines rather
 * than calling in here. A pan handler is the one place in the library that
 * cannot afford a surprise: a worklet reaching across a module boundary for a
 * helper that reaches across again for another is a chain with more ways to go
 * wrong than the arithmetic is long. What lives here is the definition, and
 * the tests hold the component to it.
 */

/** The fraction of the rail that has to be covered for the slide to count. */
export const DEFAULT_THRESHOLD = 0.9;

/** Milliseconds before an `autoReset` button offers itself again. */
export const DEFAULT_AUTO_RESET_DELAY = 1000;

/**
 * Seconds of fling counted as distance already travelled.
 *
 * A slide released at speed near the end was going to arrive, and stopping it
 * dead a few points short is the control arguing with a gesture that had
 * plainly committed. Small, because the reverse mistake — a flick from
 * halfway completing an action the reader was only playing with — is the
 * worse one.
 */
export const VELOCITY_LOOKAHEAD = 0.12;

/**
 * How far past the end the thumb can be pushed, as a divisor on the overshoot.
 *
 * The rail has an end and the finger does not, so the distance past it is
 * given back at an eighth. Without this the thumb parks under the finger with
 * a gap opening behind it, which reads as the control having come loose.
 */
export const OVERSHOOT_FRICTION = 8;

/**
 * A threshold that cannot produce a button which fires on contact.
 *
 * Zero would complete the moment the thumb moved, which is a button with a
 * gesture in front of it rather than a slide. One is allowed: it means the
 * thumb has to reach the far end exactly, which is a legitimate ask for
 * something destructive.
 */
export function resolveThreshold(threshold: number | undefined): number {
  if (threshold === undefined || !Number.isFinite(threshold)) return DEFAULT_THRESHOLD;
  return Math.min(1, Math.max(0.1, threshold));
}

/**
 * How far along the rail the thumb has been dragged, as `0` to `1`.
 *
 * `travel` is the rail minus the thumb — the distance the thumb's own leading
 * edge can actually cover. Measuring against the full rail width instead would
 * make the last thumb-width of the track unreachable, so a slide could never
 * finish.
 */
export function progressFor(translation: number, travel: number): number {
  if (travel <= 0) return 0;
  return clamp(translation / travel, 0, 1);
}

/**
 * The thumb's offset in points, rubber-banded once it passes the end.
 *
 * Before the end it follows the finger exactly. There is no easing on the way
 * out, because a thumb that lags its own finger reads as a slow app rather
 * than as a heavy control.
 */
export function offsetFor(translation: number, travel: number): number {
  if (travel <= 0) return 0;
  if (translation < 0) return translation / OVERSHOOT_FRICTION;
  if (translation <= travel) return translation;
  return travel + (translation - travel) / OVERSHOOT_FRICTION;
}

/**
 * Whether a released slide should be honoured.
 *
 * Where it got to, plus where its speed was about to carry it. A slide let go
 * short and still is refused; a slide let go short and travelling is not,
 * because the reader has already made the movement that finishes it.
 */
export function isCommitted(
  progress: number,
  velocity: number,
  travel: number,
  threshold: number
): boolean {
  if (travel <= 0) return false;
  const projected = progress + (velocity * VELOCITY_LOOKAHEAD) / travel;
  return projected >= threshold;
}

/** Keeps a number inside a range. Exported because the tests read it. */
export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}
