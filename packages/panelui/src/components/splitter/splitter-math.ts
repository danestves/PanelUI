/**
 * The arithmetic a splitter runs while a seam is under a finger.
 *
 * Sizes are percentages of the whole splitter, never points, which is what
 * makes a dragged layout survive a rotation or a window resize: the numbers
 * mean the same thing at any container size, so nothing has to be re-measured
 * and re-derived when one changes.
 *
 * It lives apart from the component for two reasons. It is the part with the
 * edge cases — a pair of panels that cannot both honour their minimums, a
 * collapse that has to decide between shut and its floor, a caller's sizes that
 * do not add up — and it is the part that runs on the UI thread, where a wrong
 * answer is a layout that sticks rather than an exception anybody sees.
 */

/** How small a panel may get before its neighbour stops taking room, in percent. */
export const DEFAULT_MIN_SIZE = 10;
/** How large a panel may get, in percent. */
export const DEFAULT_MAX_SIZE = 100;

export interface SplitterConstraint {
  /** Smallest share the panel may hold while open, in percent. */
  minSize: number;
  /** Largest share the panel may hold, in percent. */
  maxSize: number;
  /** Whether dragging past the minimum shuts the panel instead of stopping. */
  collapsible: boolean;
  /** Share the panel holds while shut, in percent. */
  collapsedSize: number;
}

export interface SplitterConstraintInput {
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean;
  collapsedSize?: number;
}

function clamp(value: number, low: number, high: number): number {
  'worklet';
  return Math.min(Math.max(value, low), high);
}

function finite(value: number | undefined, fallback: number): number {
  'worklet';
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The smallest share a panel can hold at all — its floor once shut, or its minimum. */
export function panelFloor(constraint: SplitterConstraint): number {
  'worklet';
  return constraint.collapsible ? constraint.collapsedSize : constraint.minSize;
}

/**
 * Fills a panel's declared limits in, in an order that cannot contradict
 * itself: the maximum is never below the minimum, and a collapsed size is never
 * above the minimum it exists to sit below.
 */
export function normalizeConstraint(
  input: SplitterConstraintInput | undefined
): SplitterConstraint {
  const minSize = clamp(finite(input?.minSize, DEFAULT_MIN_SIZE), 0, 100);
  const maxSize = clamp(finite(input?.maxSize, DEFAULT_MAX_SIZE), minSize, 100);
  const collapsible = input?.collapsible === true;
  const collapsedSize = clamp(finite(input?.collapsedSize, 0), 0, minSize);
  return { minSize, maxSize, collapsible, collapsedSize };
}

function total(layout: number[]): number {
  'worklet';
  let sum = 0;
  for (let index = 0; index < layout.length; index += 1) sum += layout[index]!;
  return sum;
}

/**
 * Pushes a layout onto exactly 100, moving each panel by its share of the room
 * it has left in the direction the correction is going. Panels already against
 * a limit therefore absorb none of it, which is what keeps a correction from
 * quietly undoing the limit it just honoured.
 *
 * Four passes, because clamping after each one can hand the next a smaller
 * remainder rather than none; it converges long before that in practice, and
 * the bound is what stops a contradictory set of limits from spinning.
 */
function settle(layout: number[], constraints: SplitterConstraint[]): number[] {
  'worklet';
  const next = layout.slice();

  for (let pass = 0; pass < 4; pass += 1) {
    const remainder = 100 - total(next);
    if (Math.abs(remainder) < 1e-6) break;

    let room = 0;
    const headroom: number[] = [];
    for (let index = 0; index < next.length; index += 1) {
      const constraint = constraints[index]!;
      const available =
        remainder > 0
          ? constraint.maxSize - next[index]!
          : next[index]! - panelFloor(constraint);
      headroom.push(Math.max(available, 0));
      room += Math.max(available, 0);
    }
    if (room <= 1e-6) break;

    for (let index = 0; index < next.length; index += 1) {
      next[index] = clamp(
        next[index]! + (remainder * headroom[index]!) / room,
        panelFloor(constraints[index]!),
        constraints[index]!.maxSize
      );
    }
  }

  // Minimums that add up to more than the whole cannot all be honoured. Scaling
  // the whole layout down is the failure that stays legible: every panel is
  // smaller than it asked for, rather than the last one being pushed out of the
  // container where nobody can see that it is there at all.
  const sum = total(next);
  if (sum > 100 + 1e-6) {
    for (let index = 0; index < next.length; index += 1) {
      next[index] = (next[index]! * 100) / sum;
    }
  }

  return next;
}

/**
 * Turns whatever sizes a caller gave into one layout that adds up.
 *
 * Panels with no size of their own split what the sized ones left over, so a
 * three-pane splitter that only pins its sidebar gets the sensible reading of
 * that: the sidebar keeps its number and the other two share the rest.
 */
export function resolveLayout(
  sizes: (number | undefined)[],
  constraints: SplitterConstraint[]
): number[] {
  if (constraints.length === 0) return [];

  let claimed = 0;
  let unsized = 0;
  for (let index = 0; index < constraints.length; index += 1) {
    const size = sizes[index];
    if (typeof size === 'number' && Number.isFinite(size)) {
      claimed += clamp(size, 0, 100);
    } else {
      unsized += 1;
    }
  }

  const share = unsized > 0 ? Math.max(100 - claimed, 0) / unsized : 0;
  const layout: number[] = [];
  for (let index = 0; index < constraints.length; index += 1) {
    const size = sizes[index];
    const raw =
      typeof size === 'number' && Number.isFinite(size) ? clamp(size, 0, 100) : share;
    layout.push(
      clamp(raw, panelFloor(constraints[index]!), constraints[index]!.maxSize)
    );
  }

  return settle(layout, constraints);
}

/**
 * A panel's size once it is below its minimum: shut if it is collapsible and
 * the drag has gone more than halfway there, and otherwise held at the minimum.
 *
 * The halfway point is what makes collapsing feel like a decision rather than
 * an accident — a finger that grazes the minimum springs back, and one that
 * keeps going shuts the panel.
 */
function snapDown(size: number, constraint: SplitterConstraint): number {
  'worklet';
  if (size >= constraint.minSize) return size;
  if (!constraint.collapsible) return constraint.minSize;
  return size < (constraint.collapsedSize + constraint.minSize) / 2
    ? constraint.collapsedSize
    : constraint.minSize;
}

/**
 * Moves one seam, in percent, and hands back the whole layout.
 *
 * Only the two panels either side of the seam change: a drag borrows from its
 * neighbour and nobody else, so the panels further along stay exactly where the
 * reader left them.
 *
 * Collapsing is only ever offered to the panel being shrunk. Both sides could
 * technically be past their minimum at once at the end of a long drag, and
 * shutting the panel that is currently growing is never what the drag meant.
 */
export function resizeLayout(
  layout: number[],
  boundary: number,
  delta: number,
  constraints: SplitterConstraint[]
): number[] {
  'worklet';
  const next = layout.slice();
  if (boundary < 0 || boundary + 1 >= next.length) return next;
  if (!Number.isFinite(delta)) return next;

  const first = constraints[boundary];
  const second = constraints[boundary + 1];
  if (!first || !second) return next;

  const pair = next[boundary]! + next[boundary + 1]!;
  let intended = next[boundary]! + delta;

  if (delta < 0) {
    intended = snapDown(intended, first);
  } else if (delta > 0) {
    intended = pair - snapDown(pair - intended, second);
  }

  const low = Math.max(panelFloor(first), pair - second.maxSize);
  const high = Math.min(first.maxSize, pair - panelFloor(second));
  if (low > high) return next;

  next[boundary] = clamp(intended, low, high);
  next[boundary + 1] = pair - next[boundary]!;
  return next;
}

/** Restores one pair's initial ratio without escaping its current constraints. */
export function resetLayout(
  layout: number[],
  initial: number[],
  boundary: number,
  constraints: SplitterConstraint[]
): number[] {
  const next = layout.slice();
  if (boundary < 0 || boundary + 1 >= next.length) return next;

  const pair = next[boundary]! + next[boundary + 1]!;
  const first = initial[boundary];
  const second = initial[boundary + 1];
  if (
    !Number.isFinite(pair) ||
    typeof first !== 'number' ||
    !Number.isFinite(first) ||
    typeof second !== 'number' ||
    !Number.isFinite(second) ||
    first + second <= 0
  ) {
    return next;
  }

  const target = (first / (first + second)) * pair;
  return resizeLayout(next, boundary, target - next[boundary]!, constraints);
}

/** Where a seam sits, in percent, measured from the start of the splitter. */
export function layoutOffset(layout: number[], boundary: number): number {
  'worklet';
  let offset = 0;
  for (let index = 0; index <= boundary && index < layout.length; index += 1) {
    offset += layout[index]!;
  }
  return offset;
}

/** Whether a panel is currently shut rather than merely small. */
export function isCollapsed(size: number, constraint: SplitterConstraint): boolean {
  'worklet';
  return constraint.collapsible && size <= constraint.collapsedSize + 1e-6;
}
