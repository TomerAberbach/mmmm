import { parseWithZod } from '@conform-to/zod/v4'
import {
  accountDeletionSchema,
  WRONG_ADDRESS_MESSAGE,
} from './account-deletion-forms.ts'
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
  return (await deleteEducator(educatorId, submission.value.email))
    ? onDeleted()
    : rejectForm(submission, {
        fieldErrors: { email: [WRONG_ADDRESS_MESSAGE] },
      })
}
