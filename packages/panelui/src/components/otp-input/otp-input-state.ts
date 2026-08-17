/** Resolve the native editing state without allowing `disabled` to be bypassed. */
export function resolveOtpEditable(
  editable: boolean | undefined,
  disabled: boolean | undefined
): boolean {
  return editable !== false && !disabled;
}
