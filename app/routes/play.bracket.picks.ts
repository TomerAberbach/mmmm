import type { Route } from './+types/play.bracket.picks.ts'
import { readCurrentYear } from '~/brackets.server.ts'
import { picksRequestSchema } from '~/picks-request.ts'
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

// Saves the player's draft, submits it, or discards it for their submission
export const action = async ({
  request,
  context,
}: Route.ActionArgs): Promise<Response> => {
  const parsed = picksRequestSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success) {
    return refuse(`Send a save, submit, or discard request as JSON`)
  }
  const player = readRequiredPlayer(context)
  const { yearId } = readPlayContest(context)
  // Only the current year's contests take picks. The storage functions don't
  // check the year
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
