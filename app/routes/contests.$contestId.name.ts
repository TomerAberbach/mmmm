import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.name.ts'
import type { SavedResult } from '~/components/saved-notice.tsx'
import { serverContestNameSchema } from '~/contest-forms.server.ts'
import { renameContest } from '~/contests.server.ts'
import { rejectSubmission } from '~/reject-submission.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(`/contests/${params.contestId}`)

export const action = async ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<
  SavedResult | ReturnType<typeof rejectSubmission>
> => {
  const submission = parseWithZod(await request.formData(), {
    schema: serverContestNameSchema,
  })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }
  const renamed = await renameContest(
    readRequiredEducator(context).id,
    params.contestId,
    submission.value.name,
  )
  return renamed
    ? { result: submission.reply(), saved: true }
    : rejectSubmission(submission, {
        formErrors: [`This contest is gone, so its name wasn’t saved`],
      })
}
