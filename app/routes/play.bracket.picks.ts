import { z } from 'zod'
import type { Route } from './+types/play.bracket.picks.ts'
import { TOTAL_BATTLES } from '~/picks.ts'
import {
  readPlayContest,
  readRequiredPlayer,
  requirePlayer,
} from '~/play-context.server.ts'
import { savePlayerPicks } from '~/players.server.ts'

export const middleware: Route.MiddlewareFunction[] = [requirePlayer]

const picksSchema = z.object({
  picks: z
    .record(z.string().max(40), z.string().max(200))
    .refine(picks => Object.keys(picks).length <= TOTAL_BATTLES),
})

// Replaces the player's whole set of picks
export const action = async ({
  request,
  context,
}: Route.ActionArgs): Promise<Response> => {
  const parsed = picksSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: `Send the picks as JSON` }, { status: 400 })
  }
  const saved = await savePlayerPicks(
    readRequiredPlayer(context).id,
    readPlayContest(context).yearId,
    parsed.data.picks,
  )
  return saved
    ? Response.json({ ok: true })
    : Response.json(
        { error: `These picks don’t fit the bracket` },
        { status: 400 },
      )
}
