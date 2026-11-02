import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import type { Route } from './+types/contests.new.ts'
import { readCurrentYear } from '~/brackets.server.ts'
import { serverContestNameSchema } from '~/contest-forms.server.ts'
import { createContest } from '~/contests.server.ts'
import { rejectSubmission } from '~/form-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = (): Response => redirect(`/contests`)

export const action = async ({
  request,
  context,
}: Route.ActionArgs): Promise<
  Response | ReturnType<typeof rejectSubmission>
> => {
  const submission = parseWithZod(await request.formData(), {
    schema: serverContestNameSchema,
  })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }
  const year = await readCurrentYear()
  const contestId =
    year === null
      ? null
      : await createContest(
          readRequiredEducator(context).id,
          year,
          submission.value.name,
        )
  return contestId
    ? redirect(`/contests/${contestId}`)
    : rejectSubmission(submission, {
        formErrors: [
          `Contests open once the bracket is published, so this one wasn’t created`,
        ],
      })
}
