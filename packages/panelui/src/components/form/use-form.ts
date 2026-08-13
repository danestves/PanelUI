/**
 * useForm — form state for React Native, with no form library underneath.
 *
 * Values, errors and touched state live in one `useReducer` so a single
 * dispatch can update more than one of them atomically — setting a value
 * also clears that field's error in the same update, so a field being fixed
 * never flashes invalid for one extra frame while the two states catch up
 * with each other.
 *
 * Per-field validators are not passed in here. They register themselves —
 * `useField`/`Form.Field` do this — because the field that owns the
 * validation rule is usually rendered far from the `useForm` call, and
 * threading every field's validator up to one options object would mean
 * `useForm`'s call site has to know about every field in the tree. What is
 * passed in here (`validate`) is whole-form validation: cross-field rules
 * like "confirm password must match password".
 *
 * Only flat, JSON-serializable values are supported — string, number,
 * boolean, and plain arrays/objects of those. There is no field-array helper
 * (`useFieldArray`) in this version; model a repeating group with your own
 * `useState` array of ids and one `useForm` per row, or key a field's name
 * with an index (`"emails.0"`) and treat it as an opaque string.
 *
 * `defaultValues` is read once, on the first render. If default values
 * arrive asynchronously, mount the form once you have them (e.g. behind a
 * loading check) rather than expecting the hook to pick up a later change.
 *
 * It also declares the fields. A field's `name` has to be a key of it —
 * including the empty ones, as `''`, `false`, `null`. A name it does not
 * declare has no value to give a validator and nothing to submit, so
 * `useField` says so in development rather than letting the field quietly do
 * nothing.
 */
import { useCallback, useMemo, useReducer, useRef } from 'react';

export type FieldErrors<T> = Partial<Record<keyof T, string>>;
export type FieldTouched<T> = Partial<Record<keyof T, boolean>>;

export type Validator<T extends Record<string, any>, K extends keyof T> = (
  value: T[K],
  values: T
) => string | undefined | Promise<string | undefined>;

export interface FieldState<V> {
  value: V;
  error?: string;
  touched: boolean;
}

export interface UseFormOptions<T extends Record<string, any>> {
  defaultValues: T;
  /** Whole-form validation, e.g. a rule that compares two fields. Runs on submit. */
  validate?: (values: T) => FieldErrors<T> | Promise<FieldErrors<T>>;
  onSubmit: (values: T) => void | Promise<void>;
}

export interface FormApi<T extends Record<string, any>> {
  values: T;
  errors: FieldErrors<T>;
  touched: FieldTouched<T>;
  isSubmitting: boolean;
  /** No field currently carries a validation error. Fields validate on blur and
   * submit, so this does not guarantee an untouched field would pass. */
  isValid: boolean;
  /** `values` differs from `defaultValues`, compared as JSON. */
  isDirty: boolean;
  setFieldValue: <K extends keyof T>(name: K, value: T[K]) => void;
  setFieldTouched: <K extends keyof T>(name: K, touched?: boolean) => void;
  setFieldError: <K extends keyof T>(name: K, error: string | undefined) => void;
  /** Read the latest value, including a change made before React renders again. */
  getValue: <K extends keyof T>(name: K) => T[K];
  /** Read a field from this render so a component naturally follows its changes. */
  watch: <K extends keyof T>(name: K) => T[K];
  getFieldState: <K extends keyof T>(name: K) => FieldState<T[K]>;
  /** Used by `useField`/`Form.Field` to attach a field's validation rule. */
  registerValidator: <K extends keyof T>(name: K, validator?: Validator<T, K>) => void;
  /** Runs `name`'s registered validator (if any) and records the result. */
  validateField: <K extends keyof T>(name: K) => Promise<boolean>;
  handleSubmit: () => Promise<void>;
  reset: (values?: T) => void;
}

interface State<T> {
  values: T;
  errors: FieldErrors<T>;
  touched: FieldTouched<T>;
  isSubmitting: boolean;
}

type Action<T> =
  | { type: 'SET_VALUE'; name: keyof T; value: unknown }
  | { type: 'SET_TOUCHED'; name: keyof T; touched: boolean }
  | { type: 'SET_ERROR'; name: keyof T; error: string | undefined }
  | { type: 'SET_ERRORS'; errors: FieldErrors<T> }
  | { type: 'TOUCH_ALL'; names: (keyof T)[] }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_END' }
  | { type: 'RESET'; values: T };

function reducer<T extends Record<string, any>>(
  state: State<T>,
  action: Action<T>
): State<T> {
  switch (action.type) {
    case 'SET_VALUE':
      return {
        ...state,
        values: { ...state.values, [action.name]: action.value } as T,
        errors: { ...state.errors, [action.name]: undefined },
      };
    case 'SET_TOUCHED':
      return {
        ...state,
        touched: { ...state.touched, [action.name]: action.touched },
      };
    case 'SET_ERROR':
      return { ...state, errors: { ...state.errors, [action.name]: action.error } };
    case 'SET_ERRORS':
      return { ...state, errors: { ...state.errors, ...action.errors } };
    case 'TOUCH_ALL': {
      const touched = { ...state.touched };
      for (const name of action.names) touched[name] = true;
      return { ...state, touched };
    }
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true };
    case 'SUBMIT_END':
      return { ...state, isSubmitting: false };
    case 'RESET':
      return { values: action.values, errors: {}, touched: {}, isSubmitting: false };
    default:
      return state;
  }
}

/** Stands in for the message a rule that crashed never got to return. */
const VALIDATOR_THREW = 'This field could not be validated.';

/**
 * Run one field's rule, and survive a rule that throws.
 *
 * A validator is caller code reached from a path nothing awaits — `onBlur`
 * fires and forgets, and `handleSubmit` is wired straight to a press. A throw
 * in there becomes an unhandled rejection: a red box whose message ("cannot
 * read property 'length' of undefined") names neither the field nor the rule,
 * and which takes the screen for one line of one validator.
 *
 * So it is caught, reported against the field by name, and counted as a
 * failure. Counted, rather than waved through: a rule that crashed reached no
 * verdict, and a form that submits past a rule that never ran is the worse of
 * the two outcomes — it puts unchecked values somewhere they cannot be taken
 * back from. The placeholder message is what stands between the two; the
 * console entry beside it is for whoever can fix the rule.
 */
async function runValidator<T extends Record<string, any>>(
  name: keyof T,
  validator: (value: any, values: T) => string | undefined | Promise<string | undefined>,
  values: T
): Promise<string | undefined> {
  try {
    return await validator(values[name], values);
  } catch (error) {
    console.error(
      `[PanelUI] The validator for form field "${String(name)}" threw, so the ` +
        `field is being treated as invalid.`,
      error
    );
    return VALIDATOR_THREW;
  }
}

export function useForm<T extends Record<string, any>>({
  defaultValues,
  validate,
  onSubmit,
}: UseFormOptions<T>): FormApi<T> {
  const defaultsRef = useRef(defaultValues);
  const validatorsRef = useRef<
    Partial<Record<keyof T, (value: any, values: T) => string | undefined | Promise<string | undefined>>>
  >({});
  const validationOwnersRef = useRef<Partial<Record<keyof T, symbol>>>({});
  const submissionLockedRef = useRef(false);

  const [state, dispatch] = useReducer(reducer<T>, {
    values: defaultValues,
    errors: {},
    touched: {},
    isSubmitting: false,
  });

  /*
   * The values as of the last *change*, not as of the last render.
   *
   * Validation runs in the same tick as the edit that triggered it —
   * `validateOn="change"` calls `validateField` immediately after
   * `setFieldValue`, and submit runs from a press handler. React state is a
   * render behind at that point, so a validator reading it would judge the
   * character before the one just typed, and a submit fired straight after an
   * edit would submit the value before it. The ref is written on the way into
   * the dispatch so both see what the user actually entered.
   */
  const valuesRef = useRef(state.values);
  valuesRef.current = state.values;

  /* Only the latest owner of a field may commit validation state. A value,
   * validator or manual-error change claims ownership too, invalidating any
   * result that was calculated from the state before that change. */
  const claimFieldValidation = useCallback(<K extends keyof T>(name: K) => {
    const owner = Symbol();
    validationOwnersRef.current[name] = owner;
    return owner;
  }, []);

  const setFieldValue = useCallback(
    <K extends keyof T>(name: K, value: T[K]) => {
      claimFieldValidation(name);
      valuesRef.current = { ...valuesRef.current, [name]: value } as T;
      dispatch({ type: 'SET_VALUE', name, value });
    },
    [claimFieldValidation]
  );

  const setFieldTouched = useCallback(<K extends keyof T>(name: K, touched = true) => {
    dispatch({ type: 'SET_TOUCHED', name, touched });
  }, []);

  const setFieldError = useCallback(
    <K extends keyof T>(name: K, error: string | undefined) => {
      claimFieldValidation(name);
      dispatch({ type: 'SET_ERROR', name, error });
    },
    [claimFieldValidation]
  );

  const registerValidator = useCallback(
    <K extends keyof T>(name: K, validator?: Validator<T, K>) => {
      claimFieldValidation(name);
      if (validator) {
        validatorsRef.current[name] = validator;
      } else {
        delete validatorsRef.current[name];
      }
    },
    [claimFieldValidation]
  );

  const getFieldState = useCallback(
    <K extends keyof T>(name: K): FieldState<T[K]> => ({
      value: state.values[name],
      error: state.errors[name],
      touched: !!state.touched[name],
    }),
    [state.values, state.errors, state.touched]
  );

  const getValue = useCallback(<K extends keyof T>(name: K): T[K] => valuesRef.current[name], []);
  const watch = useCallback(<K extends keyof T>(name: K): T[K] => state.values[name], [state.values]);

  const validateField = useCallback(async <K extends keyof T>(name: K) => {
    const validator = validatorsRef.current[name];
    if (!validator) return true;
    const owner = claimFieldValidation(name);
    const values = valuesRef.current;
    const error = await runValidator(name, validator, values);
    if (validationOwnersRef.current[name] === owner) {
      dispatch({ type: 'SET_ERROR', name, error });
    }
    return !error;
  }, [claimFieldValidation]);

  const handleSubmit = useCallback(async () => {
    // Reducer state cannot guard two calls made before React renders again.
    if (submissionLockedRef.current) return;
    submissionLockedRef.current = true;
    try {
      const values = valuesRef.current;
      /*
       * Every field the form knows of, which is not the same as every key of
       * `defaultValues`: a field can register a validator under a name that was
       * never declared there. Submitting only the declared ones meant such a
       * field was never validated and never blocked anything, so a form of
       * required-but-undeclared fields submitted itself while still empty.
       *
       * It is still a mistake to name a field that `defaultValues` does not
       * declare — its value stays undefined and never reaches `onSubmit` —
       * which is why `useField` says so. Validating it anyway is what turns
       * that mistake into a visible error instead of a silent submit.
       */
      const names = Array.from(
        new Set([...Object.keys(values), ...Object.keys(validatorsRef.current)])
      ) as (keyof T)[];
      const validationOwners = new Map(
        names.map((name) => [name, claimFieldValidation(name)] as const)
      );
      dispatch({ type: 'TOUCH_ALL', names });

      const fieldErrorEntries = await Promise.all(
        names.map(async (name) => {
          const validator = validatorsRef.current[name];
          const error = validator
            ? await runValidator(name, validator, values)
            : undefined;
          return [name, error] as const;
        })
      );

      /*
       * Same reasoning as a field's rule, one level up: a cross-field check that
       * throws must not take the screen, and must not let the submit through.
       * It belongs to no single field, so it blocks without marking one — there
       * is no field whose error line would be the honest place to put it.
       */
      let formErrors: FieldErrors<T> = {};
      let formValidateThrew = false;
      if (validate) {
        try {
          formErrors = await validate(values);
        } catch (error) {
          console.error(
            '[PanelUI] The form-level validate() threw, so the form is being ' +
              'treated as invalid and the submit was not run.',
            error
          );
          formValidateThrew = true;
        }
      }

      const cleared = Object.fromEntries(names.map((name) => [name, undefined]));
      const nextErrors: FieldErrors<T> = {
        ...cleared,
        ...Object.fromEntries(fieldErrorEntries.filter(([, error]) => error !== undefined)),
        ...formErrors,
      };
      const ownedErrors = Object.fromEntries(
        names
          .filter((name) => validationOwnersRef.current[name] === validationOwners.get(name))
          .map((name) => [name, nextErrors[name]])
      ) as FieldErrors<T>;
      dispatch({ type: 'SET_ERRORS', errors: ownedErrors });

      if (formValidateThrew || Object.values(nextErrors).some(Boolean)) return;

      dispatch({ type: 'SUBMIT_START' });
      try {
        await onSubmit(values);
      } finally {
        dispatch({ type: 'SUBMIT_END' });
      }
    } finally {
      submissionLockedRef.current = false;
    }
  }, [claimFieldValidation, validate, onSubmit]);

  const reset = useCallback((values: T = defaultsRef.current) => {
    validationOwnersRef.current = {};
    valuesRef.current = values;
    dispatch({ type: 'RESET', values });
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(state.values) !== JSON.stringify(defaultsRef.current),
    [state.values]
  );
  const isValid = useMemo(
    () => Object.values(state.errors).every((error) => !error),
    [state.errors]
  );

  return {
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    isSubmitting: state.isSubmitting,
    isValid,
    isDirty,
    setFieldValue,
    setFieldTouched,
    setFieldError,
    getValue,
    watch,
    getFieldState,
    registerValidator,
    validateField,
    handleSubmit,
    reset,
  };
}
