import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.trash.erase.ts'
import type { ConfirmReply } from '~/form-replies.server.ts'
import { changeListed } from '~/form-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { erasePlayers } from '~/trash.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId/trash`, params))

export const action = ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<ConfirmReply> => {
  const { id } = readRequiredEducator(context)
  return changeListed(
    request,
    ids => erasePlayers(id, params.contestId, ids),
    `deleted`,
  )
}
