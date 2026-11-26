import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.delete.ts'
import { deleteUnpublishedBracket, readAdminYears } from '~/brackets.server.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/admin/bracket`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<Response | ConfirmResult> => {
  const { setupYear: year } = await readAdminYears()
  const formData = await request.formData()
  return year !== null &&
    formData.get(`year`) === String(year) &&
    (await deleteUnpublishedBracket(year))
    ? redirect(href(`/admin`))
    : { error: `This bracket is already published or deleted` }
}
