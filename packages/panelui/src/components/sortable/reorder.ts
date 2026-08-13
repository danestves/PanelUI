type PinnedItems = Readonly<Record<string, boolean>>;

/**
 * Move one item, then restore pinned items to the slots in `laid`.
 *
 * Restoring after the move lets an item cross a pin instead of turning that
 * slot into a wall. The laid-out order is the source of truth because it is
 * the last arrangement the caller rendered and therefore the one whose pins
 * are known to be in their promised positions.
 */
export function moveWithPinned(
  list: readonly string[],
  laid: readonly string[],
  pinned: PinnedItems,
  id: string,
  from: number,
  to: number
): string[] {
  'worklet';
  if (
    from === to ||
    from < 0 ||
    from >= list.length ||
    to < 0 ||
    to >= list.length ||
    list[from] !== id ||
    pinned[id]
  ) {
    return [...list];
  }

  const moved = [...list];
  moved.splice(from, 1);
  moved.splice(to, 0, id);

  const next: (string | undefined)[] = [];
  let anyPinned = false;
  for (let i = 0; i < moved.length; i += 1) next.push(undefined);
  for (let i = 0; i < laid.length && i < next.length; i += 1) {
    const at = laid[i];
    if (at !== undefined && pinned[at]) {
      next[i] = at;
      anyPinned = true;
    }
  }
  if (!anyPinned) return moved;

  const free: string[] = [];
  for (let i = 0; i < moved.length; i += 1) {
    const at = moved[i];
    if (at !== undefined && !pinned[at]) free.push(at);
  }

  const result: string[] = [];
  let freeIndex = 0;
  for (let i = 0; i < next.length; i += 1) {
    const held = next[i];
    if (held !== undefined) {
      result.push(held);
      continue;
    }
    const take = free[freeIndex];
    freeIndex += 1;
    if (take !== undefined) result.push(take);
  }
  return result;
}

/** Move by one available slot, stepping past pinned slots that would be a no-op. */
export function stepWithPinned(
  list: readonly string[],
  laid: readonly string[],
  pinned: PinnedItems,
  id: string,
  from: number,
  delta: number
): string[] {
  'worklet';
  const direction = Math.sign(delta);
  if (direction === 0) return [...list];

  for (let to = from + direction; to >= 0 && to < list.length; to += direction) {
    const next = moveWithPinned(list, laid, pinned, id, from, to);
    if (next.indexOf(id) !== from) return next;
  }

  return [...list];
}
