import { parseWithZod } from '@conform-to/zod/v4'
import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.contests.hand-over.ts'
import type { HandOverReply } from '~/components/hand-over-dialog.tsx'
import { acceptForm, rejectForm } from '~/form-replies.server.ts'
import type { FormRejection } from '~/form-replies.server.ts'
import { handOverSchema } from '~/support-forms.ts'
import { findEducator, handOverContest } from '~/support.server.ts'

export const loader = (): Response => redirect(href(`/admin/contests`))

/** Answers the address with its educator, then their ID with the handover */
export const action = async ({
  request,
}: Route.ActionArgs): Promise<HandOverReply | FormRejection> => {
  const submission = parseWithZod(await request.formData(), {
    schema: handOverSchema,
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }
  const { contestId, email, educatorId } = submission.value
  const educator = await findEducator(email)
  if (!educator?.isConfirmed) {
    return rejectForm(submission, {
      fieldErrors: { email: [`No confirmed educator has this email address`] },
    })
  }
  if (educatorId !== educator.id) {
    return {
      result: submission.reply(),
      educator: { id: educator.id, name: educator.name },
    }
  }
  return (await handOverContest(contestId, educatorId))
    ? acceptForm(submission)
    : rejectForm(submission, {
        formErrors: [`This contest isn’t orphaned anymore. Reload the page`],
      })
}
