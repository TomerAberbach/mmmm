import { parseWithZod } from '@conform-to/zod/v4'
import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.contests.$contestId.erase-contest.ts'
import { contestErasureSchema } from '~/contest-forms.ts'
import { rejectForm } from '~/form-replies.server.ts'
import type { FormRejection } from '~/form-replies.server.ts'
import { eraseContest } from '~/trash.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/admin/contests/:contestId`, params))

export const action = async ({
  request,
  params,
}: Route.ActionArgs): Promise<Response | FormRejection> => {
  const submission = parseWithZod(await request.formData(), {
    schema: contestErasureSchema,
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }
  switch (await eraseContest(params.contestId, submission.value.confirmation)) {
    case `ERASED`:
      return redirect(href(`/admin/contests`))
    case `GONE`:
      return rejectForm(submission, {
        formErrors: [`This contest is gone. Reload the page`],
      })
    case `OTHER_NAME`:
      return rejectForm(submission, {
        fieldErrors: { confirmation: [`This isn’t the contest’s name`] },
      })
  }
}
