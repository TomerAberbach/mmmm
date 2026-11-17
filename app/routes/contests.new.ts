import { parseWithZod } from '@conform-to/zod/v4'
import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.new.ts'
import { contestNameSchema } from '~/contest-forms.ts'
import { createContest } from '~/contests.server.ts'
import { rejectForm } from '~/form-replies.server.ts'
import { serverFreeTextSchema } from '~/free-text.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = (): Response => redirect(href(`/contests`))

export const action = async ({
  request,
  context,
}: Route.ActionArgs): Promise<Response | ReturnType<typeof rejectForm>> => {
  const submission = parseWithZod(await request.formData(), {
    schema: contestNameSchema(serverFreeTextSchema),
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }
  const contestId = await createContest(
    readRequiredEducator(context).id,
    submission.value.name,
  )
  return contestId
    ? redirect(href(`/contests/:contestId`, { contestId }))
    : rejectForm(submission, {
        formErrors: [
          `Contests open once the bracket is published, so this one wasn’t created`,
        ],
      })
}
