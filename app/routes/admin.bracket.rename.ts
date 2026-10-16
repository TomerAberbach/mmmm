import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.rename.ts'
import { renameSchema } from '~/bracket-admin-forms.ts'
import { renameCombatant } from '~/brackets.server.ts'
import type { SavedResult } from '~/components/saved-notice.tsx'
import { rejectSubmission } from '~/reject-submission.server.ts'
import { readUpcomingYear } from '~/year.ts'

export const loader = (): Response => redirect(`/admin/bracket`)

export const action = async ({
  request,
}: Route.ActionArgs): Promise<
  ReturnType<typeof rejectSubmission> | SavedResult
> => {
  const submission = parseWithZod(await request.formData(), {
    schema: renameSchema,
  })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }
  const { combatantId, name } = submission.value
  const renamed = await renameCombatant(
    readUpcomingYear(new Date()),
    combatantId,
    name,
  )
  return `error` in renamed
    ? rejectSubmission(submission, { fieldErrors: { name: [renamed.error] } })
    : { result: submission.reply(), saved: true as const }
}
