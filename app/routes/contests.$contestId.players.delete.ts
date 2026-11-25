import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.players.delete.ts'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { changeListed } from '~/listed-change.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { deletePlayers } from '~/trash.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const { id } = readRequiredEducator(context)
  return changeListed(
    request,
    ids => deletePlayers(id, params.contestId, ids),
    `deleted`,
  )
}
