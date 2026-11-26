import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.shares.stop.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { stopSharing } from '~/shares.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = async ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const colleagueId = (await request.formData()).get(`colleagueId`)
  return typeof colleagueId === `string` &&
    (await stopSharing(
      readRequiredEducator(context).id,
      params.contestId,
      colleagueId,
    ))
    ? { ok: true }
    : { error: `This contest is no longer shared with them. Reload the page` }
}
