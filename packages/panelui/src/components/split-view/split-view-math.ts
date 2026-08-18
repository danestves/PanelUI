/**
 * The arithmetic a split view runs while its seam is under a finger.
 *
 * A split view differs from a free-resize splitter in one way that decides the
 * whole of this file: it does not stop wherever the finger stopped. It settles
 * on one of a few heights the caller named, so the numbers a drag produces are
 * only ever on the way to one of those — and picking which one, from a position
 * and the speed it arrived at, is the part with the edge cases.
 *
 * It lives apart from the component because it runs on the UI thread, where a
 * wrong answer is a pane that sticks rather than an exception anybody sees.
 */

/** Smallest top pane, in points, when the caller names none. */
export const DEFAULT_MIN_HEIGHT = 100;

/** Where the panes sit when the caller names no snap points, as ratios. */
export const DEFAULT_SNAP_POINTS = [0.2, 0.5, 0.8] as const;

/**
 * How much of a flick counts toward the next snap point, in points per point of
 * velocity. A release is at the height the finger left *plus* where the throw
 * was going, so a fast flick carries past a midpoint the finger never crossed —
 * which is the difference between a control that follows a gesture and one that
 * merely records where it ended.
 */
const VELOCITY_REACH = 0.12;

/** How far a flick may reach on its own, as a fraction of the room available. */
const VELOCITY_CEILING = 0.4;

/** The nearest entry to a height, by index. */
function closestIndex(height: number, points: readonly number[]): number {
  'worklet';
  let best = 0;
  let bestDistance = Math.abs(points[0]! - height);
  for (let index = 1; index < points.length; index += 1) {
    const distance = Math.abs(points[index]! - height);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

export function clamp(value: number, low: number, high: number): number {
  'worklet';
  return Math.min(Math.max(value, low), high);
}

/**
 * One length, in points, from the two ways of writing it.
 *
 * A number at or below 1 is a fraction of the room the panes share, which is
 * what survives a rotation: half is half at any screen size. Anything larger is
 * already points. A negative number is measured back from the far edge, for the
 * case that is always written as a subtraction — "everything but the last 80".
 */
export function resolveLength(
  value: number | undefined,
  room: number,
  fallback: number
): number {
  'worklet';
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (value < 0) return room + value;
  return value <= 1 ? value * room : value;
}

/**
 * The heights a seam may settle at, in points, in order and without repeats.
 *
 * Every point is clamped into the range the panes are allowed, which is what
 * lets a caller name ratios without also checking them against a minimum they
 * did not choose. Two points that clamp onto each other become one, because a
 * list with the same height twice makes a flick land on a snap that looks like
 * it did nothing.
 */
export function resolveSnapPoints(
  points: readonly number[] | undefined,
  room: number,
  minPx: number,
  maxPx: number
): number[] {
  'worklet';
  const source = points && points.length > 0 ? points : DEFAULT_SNAP_POINTS;
  const resolved: number[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const raw = source[index]!;
    if (!Number.isFinite(raw)) continue;
    const height = clamp(resolveLength(raw, room, minPx), minPx, maxPx);
    let seen = false;
    for (let other = 0; other < resolved.length; other += 1) {
      if (Math.abs(resolved[other]! - height) < 0.5) seen = true;
    }
    if (!seen) resolved.push(height);
  }

  if (resolved.length === 0) resolved.push(clamp(minPx, minPx, maxPx));
  resolved.sort((a, b) => a - b);
  return resolved;
}

/**
 * Which snap point a release belongs to.
 *
 * The height it is measured against is where the pane is plus where the throw
 * was going, so a fast flick carries past a midpoint the finger never crossed —
 * the difference between a control that follows a gesture and one that merely
 * records where it ended.
 *
 * The result is then held to one point either side of where the pane actually
 * is. Capping the distance is not enough on its own: the same throw skips two
 * points in a list packed close together and none in a list spread wide, so the
 * guarantee has to be made in points rather than in pixels. A release that
 * lands two snaps from where it was aimed reads as the control guessing.
 */
export function nearestSnapIndex(
  height: number,
  points: readonly number[],
  velocity: number,
  room: number
): number {
  'worklet';
  if (points.length === 0) return 0;

  const reach = clamp(
    velocity * VELOCITY_REACH,
    -room * VELOCITY_CEILING,
    room * VELOCITY_CEILING
  );

  const resting = closestIndex(height, points);
  const thrown = closestIndex(height + reach, points);
  return clamp(thrown, resting - 1, resting + 1);
}

/** The index a caller asked to start at, kept inside the list that exists. */
export function normalizeSnapIndex(index: number | undefined, length: number): number {
  'worklet';
  if (length === 0) return 0;
  if (typeof index !== 'number' || !Number.isFinite(index)) return 0;
  return clamp(Math.round(index), 0, length - 1);
}
