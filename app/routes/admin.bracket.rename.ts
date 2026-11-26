import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.rename.ts'
import { renameSchema } from '~/bracket-admin-forms.ts'
import { readCurrentYear, renameCombatant } from '~/brackets.server.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/admin/results`))

export const action = ({
  request,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(request, renameSchema, async ({ combatantId, name }) => {
    const current = await readCurrentYear()
    if (!current) {
      return { formErrors: [`No bracket is published. Reload the page`] }
    }
    const renamed = await renameCombatant(current.year, combatantId, name)
    return `error` in renamed
      ? { fieldErrors: { name: [renamed.error] } }
      : null
  })
