import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.contests.$contestId.erase.ts'
import type { ConfirmReply } from '~/form-replies.server.ts'
import { refuseStale } from '~/form-replies.server.ts'
import { erasePlayer } from '~/trash.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/admin/contests/:contestId`, params))

export const action = async ({
  request,
  params,
}: Route.ActionArgs): Promise<ConfirmReply> => {
  const playerId = (await request.formData()).get(`playerId`)
  return typeof playerId === `string` &&
    (await erasePlayer(params.contestId, playerId))
    ? { ok: true }
    : refuseStale(`This bracket is gone. Reload the page`)
}
