import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.expected-lock-date.ts'
import { expectedLockDateSchema } from '~/bracket-admin-forms.ts'
import { setExpectedLockDate } from '~/brackets.server.ts'
import { fromIsoDate } from '~/dates.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { acceptSubmission, rejectSubmission } from '~/form-replies.server.ts'
import { readUpcomingYear } from '~/year.ts'

export const loader = (): Response => redirect(`/admin/bracket`)

export const action = async ({
  request,
}: Route.ActionArgs): Promise<
  SavedResult | ReturnType<typeof rejectSubmission>
> => {
  const submission = parseWithZod(await request.formData(), {
    schema: expectedLockDateSchema,
  })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }
  const year = readUpcomingYear(new Date())
  const { expectedLockDate } = submission.value
  return (await setExpectedLockDate(
    year,
    expectedLockDate ? fromIsoDate(expectedLockDate) : null,
  ))
    ? acceptSubmission(submission)
    : rejectSubmission(submission, {
        formErrors: [`Set up the ${year} bracket first`],
      })
}
