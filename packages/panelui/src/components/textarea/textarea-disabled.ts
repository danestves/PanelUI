export function textareaIsDisabled(
  disabled: boolean | undefined,
  editable: boolean | undefined
): boolean {
  return !!disabled || editable === false;
}
