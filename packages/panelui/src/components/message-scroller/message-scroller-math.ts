type MessageScrollerTarget = 'start' | 'end';

export const MESSAGE_SCROLLER_EDGE_THRESHOLD = 24;

/** Distance from the viewport to the edge a jump button targets. */
export function distanceFromMessageScrollerTarget(
  target: MessageScrollerTarget,
  contentOffsetY: number,
  contentHeight: number,
  viewportHeight: number
): number {
  'worklet';

  const maximumOffset = Math.max(0, contentHeight - viewportHeight);
  const boundedOffset = Math.min(maximumOffset, Math.max(0, contentOffsetY));
  return target === 'start' ? boundedOffset : maximumOffset - boundedOffset;
}

/** Whether the control has enough distance to its target edge to be useful. */
export function isMessageScrollerTargetVisible(distance: number): boolean {
  'worklet';

  return distance > MESSAGE_SCROLLER_EDGE_THRESHOLD;
}
