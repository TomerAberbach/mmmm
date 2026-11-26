import { readBracket } from '../app/brackets.server.ts'
import { prisma } from '../app/db.server.ts'
import { readArrangement } from '../app/moves.ts'
import type { Picks } from '../app/picks.ts'
import {
  readPlayerBracket,
  savePlayerDraft,
  submitPlayerPicks,
} from '../app/player-picks.server.ts'

/** Saves the draft as a page showing the current arrangement would */
export const saveDraft = async (
  playerId: string,
  picks: Picks,
): ReturnType<typeof savePlayerDraft> =>
  savePlayerDraft(playerId, picks, await readPlayerArrangement(playerId))

/** Submits the picks as a page showing the current arrangement would */
export const submitPicks = async (
  playerId: string,
  picks: Picks,
): ReturnType<typeof submitPlayerPicks> =>
  submitPlayerPicks(playerId, picks, await readPlayerArrangement(playerId))

export const readDraftAndSubmission = async (
  playerId: string,
): Promise<
  Pick<
    Awaited<ReturnType<typeof readPlayerBracket>>,
    `draft` | `submission` | `hasClearedPicks`
  >
> => {
  const { draft, submission, hasClearedPicks } = await readPlayerBracket(
    playerId,
    await readYear(playerId),
  )
  return { draft, submission, hasClearedPicks }
}

const readPlayerArrangement = async (playerId: string): Promise<string> =>
  readArrangement((await readBracket(await readYear(playerId)))!)

const readYear = async (playerId: string): Promise<number> => {
  const { contest } = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    select: { contest: { select: { year: true } } },
  })
  return contest.year
}
