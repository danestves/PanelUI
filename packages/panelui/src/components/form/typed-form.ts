/** Attach bound helpers to the existing runtime components; no state is cloned. */
export function bindFormRuntime<
  Root,
  Field,
  UseForm,
  UseField,
>(root: Root, field: Field, useForm: UseForm, useField: UseField) {
  return Object.assign(root as object, { Field: field, useForm, useField }) as Root & {
    Field: Field;
    useForm: UseForm;
    useField: UseField;
  };
}
