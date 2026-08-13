import type { ReactNode } from 'react';
import { createForm, type FormApi } from '../src';

type SignUp = { email: string; age: number; accepted: boolean };
const SignUpForm = createForm<SignUp>();
declare const form: FormApi<SignUp>;

form.setFieldValue('email', 'reader@example.com');
form.setFieldValue('age', 42);
const email: string = form.getValue('email');
const age: number = form.watch('age');
const error: string | undefined = form.errors.accepted;

// @ts-expect-error unknown flat field name
form.setFieldValue('profile.email', 'reader@example.com');
// @ts-expect-error age is numeric
form.setFieldValue('age', '42');
// @ts-expect-error unknown field state
form.getFieldState('missing');

const field = (
  <SignUpForm form={form}>
    <SignUpForm.Field
      name="email"
      validate={(value, values) =>
        value.includes('@') && values.age >= 18 ? undefined : 'Invalid signup'
      }
    >
      {(props) => {
        const value: string = props.value;
        props.onChange(value.trim());
        return null;
      }}
    </SignUpForm.Field>
  </SignUpForm>
);

const node: ReactNode = field;
void node;

// @ts-expect-error bound field names come from SignUp
const wrongName = <SignUpForm.Field name="password">{() => null}</SignUpForm.Field>;
void wrongName;

const NumberField = SignUpForm.Field<'age'>;
const numberField = (
  <NumberField name="age">
    {(props) => {
      props.onChange(21);
      // @ts-expect-error numeric field rejects text
      props.onChange('21');
      return null;
    }}
  </NumberField>
);
void numberField;
