export type CompositeDirection = 'previous' | 'next' | 'first' | 'last';

function indexInDirection(
  direction: CompositeDirection | undefined,
  current: number,
  count: number
): number | undefined {
  if (!direction || count < 1) return undefined;
  if (direction === 'first') return 0;
  if (direction === 'last') return count - 1;
  return (current + (direction === 'next' ? 1 : -1) + count) % count;
}

/** Horizontal tablists use their visual axis, plus Home and End. */
export function tabIndexForKey(key: string, current: number, count: number): number | undefined {
  const direction: CompositeDirection | undefined = {
    ArrowLeft: 'previous',
    ArrowRight: 'next',
    Home: 'first',
    End: 'last',
  }[key] as CompositeDirection | undefined;
  return indexInDirection(direction, current, count);
}

/** Radio groups conventionally accept either arrow axis, plus Home and End. */
export function radioIndexForKey(key: string, current: number, count: number): number | undefined {
  const direction: CompositeDirection | undefined = {
    ArrowLeft: 'previous',
    ArrowUp: 'previous',
    ArrowRight: 'next',
    ArrowDown: 'next',
    Home: 'first',
    End: 'last',
  }[key] as CompositeDirection | undefined;
  return indexInDirection(direction, current, count);
}
