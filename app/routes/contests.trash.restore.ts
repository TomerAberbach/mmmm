import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.trash.restore.ts'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { changeListed } from '~/listed-change.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { restoreContests } from '~/trash.server.ts'

export const loader = (): Response => redirect(href(`/contests/trash`))

export const action = ({
  request,
  context,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const { id } = readRequiredEducator(context)
  return changeListed(request, ids => restoreContests(id, ids), `restored`)
}
