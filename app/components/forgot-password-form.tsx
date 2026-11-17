import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import { Form, href, Link } from 'react-router'
import { forgotPasswordSchema, RESET_EXPIRES_IN_HOURS } from '../auth-forms.ts'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import { Notice } from './notice.tsx'
import { PageTitle } from './page-title.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'

export const ForgotPasswordForm = ({
  lastResult,
  linkInvalid = false,
}: {
  lastResult?: SubmissionResult
  // Set when a reset link that expired or was used sent the educator here
  linkInvalid?: boolean
}) => {
  const { form, fields, isSubmitting } = useValidatedForm(
    forgotPasswordSchema,
    lastResult,
  )
  return (
    <div className='flex max-w-md flex-col gap-6'>
      <PageTitle>Reset your password</PageTitle>
      {linkInvalid && !lastResult ? (
        <Notice kind='alert'>
          That reset link has expired or was already used. Enter your email
          address to get a new one.
        </Notice>
      ) : (
        <p>
          Enter the email address you signed up with, and we&apos;ll send you a
          link to set a new password.
        </p>
      )}
      <Form
        method='post'
        action={href(`/forgot-password`)}
        {...getFormProps(form)}
        className='flex flex-col gap-5'
      >
        <TextField
          {...fieldProps(fields.email)}
          type='email'
          label='Email address'
          autoComplete='username'
        />
        <div>
          <Button type='submit' isPending={isSubmitting}>
            Send reset link
          </Button>
        </div>
        <FormError form={form} />
      </Form>
      <p>
        Remembered it? <Link to={href(`/sign-in`)}>Sign in</Link>
      </p>
    </div>
  )
}

// Every address gets this same answer, so it never reveals which belong to
// educators
export const ResetLinkSent = ({ email }: { email: string }) => (
  <div className='flex max-w-xl flex-col gap-4'>
    <PageTitle>Check your email</PageTitle>
    <p>
      If an account uses <strong className='break-all'>{email}</strong>, we sent
      it a link to reset your password. The link works once, for{` `}
      {RESET_EXPIRES_IN_HOURS} hour. Check your spam folder too.
    </p>
    <p>
      <Link to={href(`/sign-in`)}>Back to sign in</Link>
    </p>
  </div>
)
