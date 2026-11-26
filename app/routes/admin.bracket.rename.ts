import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.rename.ts'
import { renameSchema } from '~/bracket-admin-forms.ts'
import { renameCombatant } from '~/brackets.server.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/admin/results`))

export const action = ({
  request,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(request, renameSchema, async ({ year, combatantId, name }) => {
    const renamed = await renameCombatant(year, combatantId, name)
    if (`formError` in renamed) {
      return { formErrors: [renamed.formError] }
    }
    return `error` in renamed
      ? { fieldErrors: { name: [renamed.error] } }
      : null
  })
