import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.trash.restore.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { changeListed } from '~/form-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { restorePlayers } from '~/trash.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId/trash`, params))

export const action = ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const { id } = readRequiredEducator(context)
  return changeListed(
    request,
    ids => restorePlayers(id, params.contestId, ids),
    `restored`,
  )
}
