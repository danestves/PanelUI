/**
 * useField — binds one `useForm` field to a control's own props.
 *
 * A hook rather than a component that clones its child, because PanelUI's
 * controls each take a differently-shaped change prop — `onChangeText` on
 * `Input`, `onCheckedChange` on `Checkbox`, `onValueChange` on `Switch` and
 * `RadioGroup` — so the caller is the one who knows which to wire `onChange`
 * to. `Form.Field` is a thin JSX wrapper around this same hook, for callers
 * who prefer a render prop to calling a hook per field.
 */
import { useEffect, useRef } from 'react';
import type { FormApi, Validator } from './use-form';

export interface FormFieldRenderProps<V> {
  value: V;
  /** Only set once the field has been touched (blurred, or the form submitted). */
  error?: string;
  touched: boolean;
  onChange: (value: V) => void;
  onBlur: () => void;
}

export interface UseFieldOptions<T extends Record<string, any>, K extends keyof T> {
  validate?: Validator<T, K>;
  /** Runs on blur, and always on submit. `'change'` also validates on every edit. */
  validateOn?: 'blur' | 'change';
}

export function useField<T extends Record<string, any>, K extends keyof T>(
  form: FormApi<T>,
  name: K,
  { validate, validateOn = 'blur' }: UseFieldOptions<T, K> = {}
): FormFieldRenderProps<T[K]> {
  // Kept fresh every render without retriggering the registration effect —
  // an inline validator function has a new identity on every render, and
  // re-registering on every one of those would be wasted work.
  const validateRef = useRef(validate);
  validateRef.current = validate;

  const { registerValidator } = form;
  useEffect(() => {
    registerValidator(
      name,
      validate ? (value, values) => validateRef.current!(value, values) : undefined
    );
    return () => registerValidator(name, undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerValidator, name, !!validate]);

  /*
   * A name the form never declared is the one mistake this hook cannot
   * recover from: there is no value to hand a validator, so a rule as ordinary
   * as `value.length > 0` throws on a field that was only blurred, and nothing
   * the user types is ever submitted. Both failures point away from the cause,
   * so it is named here instead. Development only — the check costs a key
   * lookup, but the message is for whoever is writing the form.
   */
  const formValues = form.values;
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (name in formValues) return;
    console.warn(
      `[PanelUI] Form field "${String(name)}" is not declared in the form's ` +
        `defaultValues, so its value is undefined and it will not be submitted. ` +
        `Add "${String(name)}" to defaultValues — an empty field is still a ` +
        `declared one ("" for text, false for a toggle).`
    );
    // The declared names come from `defaultValues`, which is read once, so
    // this is a question about the name and nothing else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const { value, error, touched } = form.getFieldState(name);

  return {
    value,
    error: touched ? error : undefined,
    touched,
    onChange: (next: T[K]) => {
      form.setFieldValue(name, next);
      if (validateOn === 'change') form.validateField(name);
    },
    onBlur: () => {
      form.setFieldTouched(name, true);
      if (validateOn === 'blur') form.validateField(name);
    },
  };
}
