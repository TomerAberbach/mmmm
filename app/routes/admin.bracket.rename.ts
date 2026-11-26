import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.rename.ts'
import { renameSchema } from '~/bracket-admin-forms.ts'
import { renameCombatant } from '~/brackets.server.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'
import { readUpcomingYear } from '~/year.ts'

export const loader = (): Response => redirect(href(`/admin/bracket`))

export const action = ({
  request,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(request, renameSchema, async ({ combatantId, name }) => {
    const renamed = await renameCombatant(
      readUpcomingYear(new Date()),
      combatantId,
      name,
    )
    return `error` in renamed
      ? { fieldErrors: { name: [renamed.error] } }
      : null
  })
