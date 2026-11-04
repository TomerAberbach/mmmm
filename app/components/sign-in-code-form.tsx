import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import { Form, href, Link } from 'react-router'
import { recoveryCodeSchema, securityCodeFormSchema } from '../auth-forms.ts'
import { Button } from './button.tsx'
import { FormError } from './form-error.tsx'
import { PageTitle } from './page-title.tsx'
import { SecurityCodeField } from './security-code-field.tsx'
import { fieldProps, TextField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'

export const SignInCodeForm = ({
  lastResult,
}: {
  lastResult?: SubmissionResult
}) => {
  const { form, fields, isSubmitting } = useValidatedForm(
    securityCodeFormSchema,
    lastResult,
  )
  return (
    <div className='flex max-w-md flex-col gap-6'>
      <PageTitle>Enter your security code</PageTitle>
      <p>Open your authenticator app and enter the code it shows for MMMM.</p>
      <Form
        method='post'
        action={href(`/sign-in/code`)}
        {...getFormProps(form)}
        className='flex flex-col gap-5'
      >
        <SecurityCodeField {...fieldProps(fields.code)} />
        <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
          <Button type='submit' isPending={isSubmitting}>
            Continue
          </Button>
          <Link to={href(`/sign-in/recovery-code`)}>
            Use a recovery code instead
          </Link>
        </div>
        <FormError form={form} />
      </Form>
    </div>
  )
}

export const RecoveryCodeForm = ({
  lastResult,
  supportEmail,
}: {
  lastResult?: SubmissionResult
  supportEmail: string
}) => {
  const { form, fields, isSubmitting } = useValidatedForm(
    recoveryCodeSchema,
    lastResult,
  )
  return (
    <div className='flex max-w-md flex-col gap-6'>
      <PageTitle>Use a recovery code</PageTitle>
      <p>Enter one of the recovery codes you saved. Each code works once.</p>
      <Form
        method='post'
        action={href(`/sign-in/recovery-code`)}
        {...getFormProps(form)}
        className='flex flex-col gap-5'
      >
        <TextField
          {...fieldProps(fields.code)}
          label='Recovery code'
          autoComplete='off'
          spellCheck='false'
        />
        <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
          <Button type='submit' isPending={isSubmitting}>
            Continue
          </Button>
          <Link to={href(`/sign-in/code`)}>Use your authenticator app</Link>
        </div>
        <FormError form={form} />
      </Form>
      <p className='text-muted'>
        Lost your codes too? Email{` `}
        <a href={`mailto:${supportEmail}`}>{supportEmail}</a> from the address
        you sign in with.
      </p>
    </div>
  )
}
