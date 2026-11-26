import { createContest } from '../app/contests.server.ts'
import { prisma } from '../app/db.server.ts'
import type { SubmissionStatus } from '../app/generated/prisma/client.ts'
import { createPlayer, readContestPlayer } from '../app/players.server.ts'
import { createEducator } from './educators.ts'
import { addYear } from './years.ts'

/** Creates the contest in the current year, and returns its ID */
export const addContest = async (
  educatorId: string,
  name: string,
): Promise<string> => {
  const contestId = await createContest(educatorId, name)
  if (contestId === null) {
    throw new Error(`The current year refused the contest`)
  }
  return contestId
}

/** Publishes a new current year with a contest in it */
export const createContestInNewYear = async (): Promise<{
  contestId: string
  year: number
}> => {
  const year = await addYear({ published: true })
  const contestId = await addContest(await createEducator(), `Period 2 Biology`)
  return { contestId, year }
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

/**
 * Publishes a new current year, creates a player in a contest there, and
 * returns the player's ID and the year
 */
export const createPlayerInNewYear = async (): Promise<{
  playerId: string
  year: number
}> => {
  const { contestId, year } = await createContestInNewYear()
  const { id } = await addPlayer(contestId)
  return { playerId: id, year }
}

/**
 * Gives the player a submission with the status, without picks, for tests of
 * what an educator sees and changes
 */
export const addSubmission = async (
  playerId: string,
  status: SubmissionStatus = `PENDING`,
): Promise<void> => {
  await prisma.submission.create({
    data: { playerId, status, picksChangedAt: new Date() },
  })
}

export const readLinkSecret = async (contestId: string): Promise<string> =>
  (
    await prisma.contest.findUniqueOrThrow({
      where: { id: contestId },
      select: { linkSecret: true },
    })
  ).linkSecret

export const readEducatorId = async (contestId: string): Promise<string> =>
  (
    await prisma.contest.findUniqueOrThrow({
      where: { id: contestId },
      select: { educatorId: true },
    })
  ).educatorId
