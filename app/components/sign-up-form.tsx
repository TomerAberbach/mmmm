import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import { Form, Link } from 'react-router'
import { MIN_PASSWORD_LENGTH, signUpSchema } from '../auth-forms.ts'
import { Button } from './button.tsx'
import { PageTitle } from './page-title.tsx'
import { PlayerNote } from './player-note.tsx'
import { fieldProps, PasswordField, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'

export const SignUpForm = ({
  lastResult,
}: {
  lastResult?: SubmissionResult
}) => {
  const { form, fields, isSubmitting } = useValidatedForm(
    signUpSchema,
    lastResult,
  )
  return (
    <div className='flex max-w-md flex-col gap-6'>
      <PageTitle>Sign up</PageTitle>
      <PlayerNote />
      <Form
        method='post'
        action='/sign-up'
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
            <Link to='/privacy'>privacy policy</Link> and confirm that you or
            your school consent for players under 13 to use MMMM.
          </p>
        </div>
      </Form>
      <p>
        Already have an account? <Link to='/sign-in'>Sign in</Link>
      </p>
    </div>
  )
}
