import type { Route } from './+types/play.bracket.picks.ts'
import { picksRequestSchema } from '~/picks-request.ts'
import type { PicksRequest } from '~/picks-request.ts'
import {
  readPlayContest,
  readRequiredPlayer,
  requirePlayer,
} from '~/play-context.server.ts'
import {
  discardPlayerDraft,
  savePlayerDraft,
  submitPlayerPicks,
} from '~/player-picks.server.ts'

export const middleware: Route.MiddlewareFunction[] = [requirePlayer]

// Saves the player's draft, submits it, or discards it for their submission.
// The picker reads only the status
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
  const { yearId } = readPlayContest(context)
  const result = await writePicks(id, yearId, parsed.data)
  return `refusal` in result ? refuse() : new Response(null)
}

const refuse = (): Response => new Response(null, { status: 400 })

const writePicks = (
  playerId: string,
  yearId: number,
  request: PicksRequest,
) => {
  switch (request.intent) {
    case `save`:
      return savePlayerDraft(playerId, yearId, request.picks)
    case `submit`:
      return submitPlayerPicks(playerId, yearId, request.picks)
    case `discard`:
      return discardPlayerDraft(playerId, yearId)
  }
}
