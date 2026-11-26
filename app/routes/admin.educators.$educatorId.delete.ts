import { parseWithZod } from '@conform-to/zod/v4'
import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.educators.$educatorId.delete.ts'
import {
  accountDeletionSchema,
  WRONG_ADDRESS_MESSAGE,
} from '~/account-deletion-forms.ts'
import { deleteEducator } from '~/educator-deletion.server.ts'
import type { FormRejection } from '~/form-replies.server.ts'
import { rejectForm } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/admin/educators`))

export const action = async ({
  request,
  params,
}: Route.ActionArgs): Promise<Response | FormRejection> => {
  const submission = parseWithZod(await request.formData(), {
    schema: accountDeletionSchema,
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }
  return (await deleteEducator(params.educatorId, submission.value.email))
    ? redirect(href(`/admin/educators`))
    : rejectForm(submission, {
        fieldErrors: { email: [WRONG_ADDRESS_MESSAGE] },
      })
}
