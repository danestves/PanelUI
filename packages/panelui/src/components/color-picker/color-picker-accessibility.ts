/**
 * Returns an accessibility action only while the picker is interactive.
 *
 * React Native can still deliver an action to a disabled adjustable view, so
 * the handler has to enforce the same disabled boundary as its touch gesture.
 */
export function enabledColorPickerAction(
  actionName: string,
  disabled: boolean
): string | undefined {
  return disabled ? undefined : actionName;
}
