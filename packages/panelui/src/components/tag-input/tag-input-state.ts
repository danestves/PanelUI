/** The exact slot a first Backspace armed for removal. */
export interface MarkedTag {
  index: number;
  tag: string;
}

/**
 * Keeps an armed removal only while the same tag still occupies the same slot.
 * Controlled fields can replace or reorder their value between key presses;
 * a mark from the old value must never authorize deleting the new one.
 */
export function reconcileMarkedTag(
  marked: MarkedTag | null,
  tags: readonly string[]
): MarkedTag | null {
  if (marked === null) return null;
  return tags[marked.index] === marked.tag ? marked : null;
}
