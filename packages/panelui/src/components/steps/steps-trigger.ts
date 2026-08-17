export function stepsTriggerDisabled(
  itemDisabled: boolean,
  triggerDisabled: boolean | null | undefined
): boolean {
  return itemDisabled || !!triggerDisabled;
}
