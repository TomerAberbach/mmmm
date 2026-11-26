import { parseWithZod } from '@conform-to/zod/v4'
import { href, redirect } from 'react-router'
import type { Route } from './+types/settings.delete-account.ts'
import {
  accountDeletionSchema,
  WRONG_ADDRESS_MESSAGE,
} from '~/account-deletion-forms.ts'
import { auth } from '~/auth.server.ts'
import { deleteEducator } from '~/educator-deletion.server.ts'
import type { FormRejection } from '~/form-replies.server.ts'
import { rejectForm } from '~/form-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = (): Response => redirect(href(`/settings`))

export const action = async ({
  request,
  context,
}: Route.ActionArgs): Promise<Response | FormRejection> => {
  const submission = parseWithZod(await request.formData(), {
    schema: accountDeletionSchema,
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }
  const { id } = readRequiredEducator(context)
  if (!(await deleteEducator(id, submission.value.email))) {
    return rejectForm(submission, {
      fieldErrors: { email: [WRONG_ADDRESS_MESSAGE] },
    })
  }
  // The session went with the account, so this only clears its cookies
  const { headers } = await auth.api.signOut({
    headers: request.headers,
    returnHeaders: true,
  })
  return redirect(href(`/account-deleted`), { headers })
}
