import { z } from 'zod'
import type { Route } from './+types/play.bracket.picks.ts'
import { readCurrentYear } from '~/brackets.server.ts'
import { TOTAL_BATTLES } from '~/picks.ts'
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

const picksSchema = z
  .record(z.string().max(40), z.string().max(200))
  .refine(picks => Object.keys(picks).length <= TOTAL_BATTLES)

const requestSchema = z.discriminatedUnion(`intent`, [
  z.object({ intent: z.literal(`save`), picks: picksSchema }),
  z.object({ intent: z.literal(`submit`), picks: picksSchema }),
  z.object({ intent: z.literal(`discard`) }),
])

export type PicksRequest = z.infer<typeof requestSchema>

// Saves the player's draft, submits it, or discards it for their submission
export const action = async ({
  request,
  context,
}: Route.ActionArgs): Promise<Response> => {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return refuse(`Send a save, submit, or discard request as JSON`)
  }
  const player = readRequiredPlayer(context)
  const { yearId } = readPlayContest(context)
  // Only the current year's contests take picks. The storage functions don't
  // check, so tests can use years that aren't current
  if ((await readCurrentYear()) !== yearId) {
    return refuse(`This contest’s year is over`)
  }
  switch (parsed.data.intent) {
    case `save`:
      return (await savePlayerDraft(player.id, yearId, parsed.data.picks))
        ? Response.json({ ok: true })
        : refuse(`These picks don’t fit the bracket`)
    case `submit`:
      return (await submitPlayerPicks(player.id, yearId, parsed.data.picks))
        ? Response.json({ ok: true })
        : refuse(`Pick all ${TOTAL_BATTLES} battles to submit`)
    case `discard`:
      return (await discardPlayerDraft(player.id))
        ? Response.json({ ok: true })
        : refuse(`There’s no submitted bracket to go back to`)
  }
}

const refuse = (error: string): Response =>
  Response.json({ error }, { status: 400 })
