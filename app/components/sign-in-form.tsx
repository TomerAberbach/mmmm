import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import { Form, Link } from 'react-router'
import { signInSchema } from '../auth-forms.ts'
import { signInWithPasskey } from '../passkeys.ts'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import { Notice } from './notice.tsx'
import { PageTitle } from './page-title.tsx'
import { PasskeyButton } from './passkey-button.tsx'
import { PlayerNote } from './player-note.tsx'
import { fieldProps, PasswordField, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'

// Where a link left the educator: confirmed, with a confirmation link that
// expired or was altered, or with a new password. Or the code page ran out of
// time or attempts
export type SignInNotice =
  `confirmed` | `link-invalid` | `password-reset` | `challenge-expired`

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
      {shownNotice === `password-reset` ? (
        <Notice kind='status'>
          Your password is changed. Sign in with your new password.
        </Notice>
      ) : null}
      {shownNotice === `challenge-expired` ? (
        <Notice kind='alert'>
          Your sign-in timed out before the code was accepted. Sign in again.
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
        action='/sign-in'
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
        <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
          <Button type='submit' isPending={isSubmitting}>
            Sign in
          </Button>
          <Link to='/forgot-password'>Forgot password?</Link>
        </div>
        <FormError form={form} />
      </Form>
      <div className='flex flex-col gap-3'>
        <p>Have a passkey?</p>
        <PasskeyButton
          ceremony={signInWithPasskey}
          successTo='/'
          variant='secondary'
        >
          Sign in with a passkey
        </PasskeyButton>
      </div>
      <p>
        New to MMMM? <Link to='/sign-up'>Sign up</Link>
      </p>
    </div>
  )
}
