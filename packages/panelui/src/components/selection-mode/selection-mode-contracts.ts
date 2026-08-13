/** The effective selection cap. Invalid and negative caps allow no additions. */
function selectionLimit(max?: number): number {
  if (max === undefined || max === Infinity) return Infinity;
  return Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;
}

/** Add one value without duplicating it or crossing the configured cap. */
export function selectValue(selected: string[], value: string, max?: number): string[] {
  if (selected.includes(value) || !(selected.length < selectionLimit(max))) return selected;
  return [...selected, value];
}

/** Remove an existing value, or add it under the same contract used by entry. */
export function toggleValue(selected: string[], value: string, max?: number): string[] {
  return selected.includes(value)
    ? selected.filter((entry) => entry !== value)
    : selectValue(selected, value, max);
}

/** The values produced by select-all, capped by the same normalized limit. */
export function selectAllValues(values: string[], max?: number): string[] {
  const limit = selectionLimit(max);
  return limit === Infinity ? [...values] : values.slice(0, limit);
}

/** How many selections constitute all selectable values. */
export function selectionTarget(total: number, max?: number): number {
  return Math.min(total, selectionLimit(max));
}

/**
 * A selection-ineligible row keeps its ordinary action in every mode. Only an
 * active, eligible row gives its press to selection.
 */
export function selectionOwnsPress(active: boolean, disabled: boolean): boolean {
  return active && !disabled;
}

/** Execute the one action owned by a row press under the interaction contract. */
export function handleSelectionItemPress(
  active: boolean,
  disabled: boolean,
  toggle: () => void,
  action?: () => void
): void {
  if (selectionOwnsPress(active, disabled)) toggle();
  else action?.();
}

/** Long press enters only from an inactive screen row that can be selected. */
export function canEnterSelection(active: boolean, disabled: boolean, sheet: boolean): boolean {
  return !active && !disabled && !sheet;
}
