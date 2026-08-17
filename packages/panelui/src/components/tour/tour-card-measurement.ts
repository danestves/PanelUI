/** A measured Tour card height tied to the step that produced it. */
export interface TourCardMeasurement {
  owner: object | undefined;
  height: number;
}

/**
 * Returns a height only when it belongs to the step currently being rendered.
 * A previous step can be much taller or shorter, so reusing its height would
 * place the next card incorrectly before that card's first layout pass.
 */
export function currentTourCardHeight(
  owner: object | undefined,
  measurement: TourCardMeasurement | null
): number | null {
  return measurement && measurement.owner === owner ? measurement.height : null;
}

/** Stores a card height without churning state for sub-pixel layout noise. */
export function nextTourCardMeasurement(
  owner: object | undefined,
  height: number,
  current: TourCardMeasurement | null
): TourCardMeasurement {
  if (current && current.owner === owner && Math.abs(current.height - height) < 1) {
    return current;
  }
  return { owner, height };
}
