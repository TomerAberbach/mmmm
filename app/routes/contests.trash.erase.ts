import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.trash.erase.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { changeListed } from '~/form-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { eraseContests } from '~/trash.server.ts'

export const loader = (): Response => redirect(href(`/contests/trash`))

export const action = ({
  request,
  context,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const { id } = readRequiredEducator(context)
  return changeListed(request, ids => eraseContests(id, ids), `deleted`)
}
