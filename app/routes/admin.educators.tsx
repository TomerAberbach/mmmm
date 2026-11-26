import { getFormProps } from '@conform-to/react'
import { parseWithZod } from '@conform-to/zod/v4'
import { Form } from 'react-router'
import type { Route } from './+types/admin.educators.ts'
import { Button } from '~/components/button.tsx'
import { EducatorSupport } from '~/components/educator-support.tsx'
import { FormError } from '~/components/form-error.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { fieldProps, TextField } from '~/components/text-field.tsx'
import { useValidatedForm } from '~/components/use-validated-form.ts'
import { rejectForm } from '~/form-replies.server.ts'
import { addressSchema } from '~/support-forms.ts'
import { findEducator } from '~/support.server.ts'

/** A form's post, so an address never appears in the page's own address */
export const action = async ({ request }: Route.ActionArgs) => {
  const submission = parseWithZod(await request.formData(), {
    schema: addressSchema,
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }
  const educator = await findEducator(submission.value.email)
  return educator
    ? { educator, result: submission.reply() }
    : rejectForm(submission, {
        fieldErrors: { email: [`No educator has this email address`] },
      })
}

const AdminEducators = ({ actionData }: Route.ComponentProps) => {
  const { form, fields, isSubmitting } = useValidatedForm(
    addressSchema,
    actionData?.result,
  )
  const educator =
    actionData && `educator` in actionData ? actionData.educator : null
  return (
    <div className='flex max-w-xl flex-col gap-8'>
      <PageTitle>Educators</PageTitle>
      <Form
        method='post'
        {...getFormProps(form)}
        className='flex flex-col gap-4'
      >
        <TextField
          {...fieldProps(fields.email)}
          type='email'
          label='Email address'
          autoComplete='off'
        />
        <div>
          <Button type='submit' isPending={isSubmitting}>
            Find educator
          </Button>
        </div>
        <FormError form={form} />
      </Form>
      {educator ? (
        <EducatorSupport key={educator.id} educator={educator} />
      ) : null}
    </div>
  )
}
export default AdminEducators
