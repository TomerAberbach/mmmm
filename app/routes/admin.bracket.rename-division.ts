import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.rename-division.ts'
import { divisionRenameSchema } from '~/bracket-admin-forms.ts'
import { renameDivision } from '~/brackets.server.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/admin/results`))

export const action = ({
  request,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(request, divisionRenameSchema, async ({ year, position, name }) => {
    const renamed = await renameDivision(year, position, name)
    if (`formError` in renamed) {
      return { formErrors: [renamed.formError] }
    }
    return `error` in renamed
      ? { fieldErrors: { name: [renamed.error] } }
      : null
  })
