import { parseWithZod } from '@conform-to/zod/v4'
import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.name.ts'
import { contestNameSchema } from '~/contest-forms.ts'
import { renameContest } from '~/contests.server.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { acceptForm, rejectForm } from '~/form-replies.server.ts'
import { serverFreeTextSchema } from '~/free-text.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = async ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<SavedResult | ReturnType<typeof rejectForm>> => {
  const submission = parseWithZod(await request.formData(), {
    schema: contestNameSchema(serverFreeTextSchema),
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }
  const renamed = await renameContest(
    readRequiredEducator(context).id,
    params.contestId,
    submission.value.name,
  )
  return renamed
    ? acceptForm(submission)
    : rejectForm(submission, {
        formErrors: [`This contest is gone, so its name wasn’t saved`],
      })
}
