export type PlannerGridNavigationKey =
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Home'
  | 'End';

/** Returns the next visible cell for a bounded, row-major month grid. */
export function plannerGridTarget(
  key: string,
  index: number,
  count: number,
  columns = 7
): number | null {
  if (!Number.isInteger(index) || index < 0 || index >= count || columns < 1) {
    return null;
  }

  let target: number;
  switch (key as PlannerGridNavigationKey) {
    case 'ArrowLeft':
      target = index - 1;
      break;
    case 'ArrowRight':
      target = index + 1;
      break;
    case 'ArrowUp':
      target = index - columns;
      break;
    case 'ArrowDown':
      target = index + columns;
      break;
    case 'Home':
      target = index - (index % columns);
      break;
    case 'End':
      target = index + (columns - 1 - (index % columns));
      break;
    default:
      return null;
  }

  return target >= 0 && target < count ? target : index;
}
