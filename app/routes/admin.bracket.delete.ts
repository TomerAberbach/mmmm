import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.bracket.delete.ts'
import { deleteUnpublishedBracket, readAdminYears } from '~/brackets.server.ts'
import type { ConfirmReply } from '~/form-replies.server.ts'
import { refuseStale } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/admin/bracket`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<Response | ConfirmReply> => {
  const { setupYear: year } = await readAdminYears()
  const formData = await request.formData()
  const seenVersion = formData.get(`seenVersion`)
  const deletion =
    year !== null &&
    formData.get(`year`) === String(year) &&
    typeof seenVersion === `string`
      ? await deleteUnpublishedBracket(year, seenVersion)
      : `GONE`
  switch (deletion) {
    case `DELETED`:
      return redirect(href(`/admin`))
    case `GONE`:
      return refuseStale(
        `This bracket is already published or deleted. Reload the page`,
      )
    case `STALE`:
      return refuseStale(
        `This bracket changed since the page loaded. Reload the page`,
      )
  }
}
