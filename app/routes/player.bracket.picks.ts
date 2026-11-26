import { href, redirect } from 'react-router'
import type { Route } from './+types/player.bracket.picks.ts'
import { OTHER_PLAYER_STATUS } from '~/other-player.ts'
import { picksRequestSchema } from '~/picks-request.ts'
import type { PicksRequest } from '~/picks-request.ts'
import { readRequiredPlayer } from '~/play-context.server.ts'
import {
  discardPlayerDraft,
  savePlayerDraft,
  submitPlayerPicks,
} from '~/player-picks.server.ts'
import { LOCKED_STATUS } from '~/submissions-locked.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/player/:contestId/bracket`, params))

/**
 * Saves the player's draft, submits it, or discards it for their submission,
 * unless the page showed another player. On a shared computer, the next player
 * may have started since. The picker reads only the status
 */
export const action = async ({
  request,
  context,
}: Route.ActionArgs): Promise<Response> => {
  const parsed = picksRequestSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return refuse()
  }
  const { id } = readRequiredPlayer(context)
  if (parsed.data.playerId !== id) {
    return new Response(null, { status: OTHER_PLAYER_STATUS })
  }
  const result = await writePicks(id, parsed.data)
  if (`refusal` in result) {
    return result.refusal === `NOT_OPEN`
      ? new Response(null, { status: LOCKED_STATUS })
      : refuse()
  }
  return new Response(null)
}

const refuse = (): Response => new Response(null, { status: 400 })

const writePicks = (playerId: string, request: PicksRequest) => {
  switch (request.intent) {
    case `save`:
      return savePlayerDraft(playerId, request.picks, request.arrangement)
    case `submit`:
      return submitPlayerPicks(playerId, request.picks, request.arrangement)
    case `discard`:
      return discardPlayerDraft(playerId)
  }
}
