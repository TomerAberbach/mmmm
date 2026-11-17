import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import { Form, href, Link } from 'react-router'
import { MIN_PASSWORD_LENGTH, signUpSchema } from '../auth-forms.ts'
import { freeTextSchema } from '../free-text.ts'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import { PageTitle } from './page-title.tsx'
import { PlayerNote } from './player-note.tsx'
import { fieldProps, PasswordField, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'

const SIGN_UP_SCHEMA = signUpSchema(freeTextSchema)

export const SignUpForm = ({
  lastResult,
}: {
  lastResult?: SubmissionResult
}) => {
  const { form, fields, isSubmitting } = useValidatedForm(
    SIGN_UP_SCHEMA,
    lastResult,
  )
  return (
    <div className='flex max-w-md flex-col gap-6'>
      <PageTitle>Sign up</PageTitle>
      <PlayerNote />
      <Form
        method='post'
        action={href(`/sign-up`)}
        {...getFormProps(form)}
        className='flex flex-col gap-5'
      >
        <TextField
          {...fieldProps(fields.name)}
          label='Full name'
          autoComplete='name'
        />
        <TextField
          {...fieldProps(fields.email)}
          type='email'
          label='Email address'
          description="We'll send a link to confirm it"
          autoComplete='email'
        />
        <PasswordField
          {...fieldProps(fields.password)}
          label='Create a password'
          description={`At least ${MIN_PASSWORD_LENGTH} characters`}
          autoComplete='new-password'
        />
        <div className='flex flex-col items-start gap-3'>
          <Button type='submit' isPending={isSubmitting}>
            Sign up
          </Button>
          <p className='text-sm text-muted'>
            By signing up, you agree to the{` `}
            <Link to={href(`/privacy`)}>privacy policy</Link> and confirm that
            you or your school consent for players under 13 to use MMMM.
          </p>
        </div>
        <FormError form={form} />
      </Form>
      <p>
        Already have an account? <Link to={href(`/sign-in`)}>Sign in</Link>
      </p>
    </div>
  )
}
