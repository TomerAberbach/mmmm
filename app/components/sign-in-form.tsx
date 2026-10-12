import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import { Form, Link } from 'react-router'
import { signInSchema } from '../auth-forms.ts'
import { Button } from './button.tsx'
import { Notice } from './notice.tsx'
import { PageTitle } from './page-title.tsx'
import { PlayerNote } from './player-note.tsx'
import { fieldProps, PasswordField, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'

// Where a confirmation link left the educator: confirmed, or with a link that
// expired or was altered
export type SignInNotice = `confirmed` | `link-invalid`

export const SignInForm = ({
  lastResult,
  notice,
}: {
  // Its form error never says which of the email and password was wrong
  lastResult?: SubmissionResult
  notice?: SignInNotice
}) => {
  const { form, fields, isSubmitting } = useValidatedForm(
    signInSchema,
    lastResult,
  )
  const formError = form.errors?.[0]
  // A submission's result replaces where the link left the educator
  const shownNotice = lastResult ? undefined : notice
  return (
    <div className='flex max-w-md flex-col gap-6'>
      <PageTitle>Sign in</PageTitle>
      <PlayerNote />
      {shownNotice === `confirmed` ? (
        <Notice kind='status'>
          Your email address is confirmed. Sign in to create your first contest.
        </Notice>
      ) : null}
      {shownNotice === `link-invalid` ? (
        <Notice kind='alert'>
          That confirmation link has expired or doesn&apos;t work. Sign in to
          get a new one.
        </Notice>
      ) : null}
      <Form
        method='post'
        {...getFormProps(form)}
        className='flex flex-col gap-5'
      >
        <TextField
          {...fieldProps(fields.email)}
          type='email'
          label='Email address'
          autoComplete='username'
        />
        <PasswordField
          {...fieldProps(fields.password)}
          label='Password'
          autoComplete='current-password'
        />
        <div>
          <Button type='submit' isPending={isSubmitting}>
            Sign in
          </Button>
        </div>
        {/* Below the button, so the fields above stay put when it appears */}
        {formError ? (
          <Notice kind='alert' id={form.errorId}>
            {formError}
          </Notice>
        ) : null}
      </Form>
      <p>
        New to MMMM? <Link to='/sign-up'>Sign up</Link>
      </p>
    </div>
  )
}
