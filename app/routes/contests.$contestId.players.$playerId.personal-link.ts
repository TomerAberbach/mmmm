import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.players.$playerId.personal-link.ts'
import { replacePersonalLink } from '~/contest-players.server.ts'
import { toPersonalLink } from '~/players.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, { contestId: params.contestId }))

/** Answers with the new link, which only this response holds */
export const action = async ({
  context,
  params,
}: Route.ActionArgs): Promise<Response> => {
  const secret = await replacePersonalLink(
    readRequiredEducator(context).id,
    params.contestId,
    params.playerId,
  )
  return secret === null
    ? new Response(null, { status: 404 })
    : Response.json(
        { link: toPersonalLink(secret) },
        { headers: { 'Cache-Control': `no-store` } },
      )
}
