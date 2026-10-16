import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.ts'
import {
  bracketFormSchema,
  toBracketForm,
  toBracketInput,
} from '~/bracket-form.ts'
import {
  deleteUnpublishedBracket,
  readBracket,
  saveUnpublishedBracket,
} from '~/brackets.server.ts'
import { BracketSetupForm } from '~/components/bracket-setup-form.tsx'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { rejectSubmission } from '~/reject-submission.server.ts'
import { readUpcomingYear } from '~/year.ts'

// Only the upcoming year's bracket can be set up, and only until it's
// published
export const loader = async () => {
  const year = readUpcomingYear(new Date())
  const bracket = await readBracket(year)
  return bracket?.isPublished
    ? redirect(`/admin`)
    : { year, defaultValue: bracket ? toBracketForm(bracket.input) : undefined }
}

export const action = async ({ request }: Route.ActionArgs) => {
  const year = readUpcomingYear(new Date())
  const formData = await request.formData()
  if (formData.get(`intent`) === `delete`) {
    return (await deleteUnpublishedBracket(year))
      ? redirect(`/admin`)
      : ({
          error: `The ${year} bracket is already published or deleted`,
        } satisfies ConfirmResult)
  }

  const submission = parseWithZod(formData, { schema: bracketFormSchema })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }
  return (await saveUnpublishedBracket(year, toBracketInput(submission.value)))
    ? redirect(`/admin`)
    : rejectSubmission(submission, {
        formErrors: [
          `The ${year} bracket is published, so it can't change here`,
        ],
      })
}

const AdminBracket = ({ loaderData, actionData }: Route.ComponentProps) => (
  <BracketSetupForm
    year={loaderData.year}
    defaultValue={loaderData.defaultValue}
    lastResult={
      actionData && `result` in actionData ? actionData.result : undefined
    }
  />
)
export default AdminBracket
