import { createContest } from '../app/contests.server.ts'
import { prisma } from '../app/db.server.ts'
import { createPlayer, readContestPlayer } from '../app/players.server.ts'

/** Creates the contest in the current year, and returns its ID */
export const addContest = async (
  educatorId: string,
  name: string,
): Promise<string> => {
  const contest = await createContest(educatorId, name)
  if (`refusal` in contest) {
    throw new Error(`The contest was refused: ${contest.refusal}`)
  }
  return contest.id
}

/**
 * Creates a player in the contest, and returns the player's ID and personal
 * link's secret
 */
export const addPlayer = async (
  contestId: string,
  displayName = `Maya R.`,
): Promise<{ id: string; secret: string }> => {
  const player = await createPlayer(
    await readLinkSecret(contestId),
    displayName,
    () => Promise.resolve(undefined),
  )
  if (!(`secret` in player)) {
    throw new Error(`The contest refused the player: ${player.refusal}`)
  }
  const { id } = (await readContestPlayer(contestId, player.secret))!
  return { id, secret: player.secret }
}

export const readLinkSecret = async (contestId: string): Promise<string> =>
  (
    await prisma.contest.findUniqueOrThrow({
      where: { id: contestId },
      select: { linkSecret: true },
    })
  ).linkSecret
