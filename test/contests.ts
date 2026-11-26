import { prisma } from '../app/db.server.ts'
import type { SubmissionStatus } from '../app/generated/prisma/client.ts'
import { addContest, addPlayer } from '../prisma/fixtures.ts'
import { createEducator } from './educators.ts'
import { addYear } from './years.ts'

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

export const readEducatorId = async (contestId: string): Promise<string> =>
  (
    await prisma.contest.findUniqueOrThrow({
      where: { id: contestId, educatorId: { not: null } },
      select: { educatorId: true },
    })
  ).educatorId!
