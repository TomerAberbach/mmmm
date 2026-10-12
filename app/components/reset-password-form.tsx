import { getFormProps } from '@conform-to/react'
import type { SubmissionResult } from '@conform-to/react'
import { Form } from 'react-router'
import { MIN_PASSWORD_LENGTH, resetPasswordSchema } from '../auth-forms.ts'
import { Button } from './button.tsx'
import { PageTitle } from './page-title.tsx'
import { fieldProps, PasswordField } from './text-field.tsx'
import { useValidatedForm } from './use-validated-form.ts'

export const ResetPasswordForm = ({
  token,
  lastResult,
}: {
  token: string
  lastResult?: SubmissionResult
}) => {
  const { form, fields, isSubmitting } = useValidatedForm(
    resetPasswordSchema,
    lastResult,
  )
  return (
    <div className='flex max-w-md flex-col gap-6'>
      <PageTitle>Set a new password</PageTitle>
      <Form
        method='post'
        {...getFormProps(form)}
        className='flex flex-col gap-5'
      >
        <input type='hidden' name={fields.token.name} value={token} />
        <PasswordField
          {...fieldProps(fields.password)}
          label='New password'
          description={`At least ${MIN_PASSWORD_LENGTH} characters`}
          autoComplete='new-password'
        />
        <div>
          <Button type='submit' isPending={isSubmitting}>
            Set password
          </Button>
        </div>
      </Form>
    </div>
  )
}
