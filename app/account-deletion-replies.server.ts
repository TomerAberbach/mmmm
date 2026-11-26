import { parseWithZod } from '@conform-to/zod/v4'
import { href, redirect } from 'react-router'
import {
  accountDeletionSchema,
  WRONG_ADDRESS_MESSAGE,
} from './account-deletion-forms.ts'
import { auth } from './auth.server.ts'
import { prisma } from './db.server.ts'
import { deleteEducator } from './educator-deletion.server.ts'
import { rejectForm } from './form-replies.server.ts'
import type { FormRejection } from './form-replies.server.ts'

/**
 * Deletes the educator's account when the form has its address, and answers with
 * `onDeleted`. A `refusal` is why this session can't delete it
 */
export const answerAccountDeletion = async (
  request: Request,
  educatorId: string,
  {
    refusal,
    onDeleted,
  }: { refusal?: string | null; onDeleted: () => Response | Promise<Response> },
): Promise<Response | FormRejection> => {
  const submission = parseWithZod(await request.formData(), {
    schema: accountDeletionSchema,
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }
  if (refusal) {
    return rejectForm(submission, { formErrors: [refusal] })
  }
  if (await deleteEducator(educatorId, submission.value.email)) {
    return onDeleted()
  }
  const exists =
    (await prisma.educator.count({ where: { id: educatorId } })) > 0
  return rejectForm(
    submission,
    exists
      ? { fieldErrors: { email: [WRONG_ADDRESS_MESSAGE] } }
      : { formErrors: [`This account is gone. Reload the page`] },
  )
}

/**
 * Sends educators who deleted their own account away. The session went with the
 * account, so this only clears its cookies
 */
export const leaveDeletedAccount = async (
  request: Request,
): Promise<Response> => {
  const { headers } = await auth.api.signOut({
    headers: request.headers,
    returnHeaders: true,
  })
  return redirect(href(`/account-deleted`), { headers })
}
