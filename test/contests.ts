import { createContest } from '../app/contests.server.ts'
import { createPlayer, readContestPlayer } from '../app/players.server.ts'
import { createEducator } from './educators.ts'
import type { AddYear } from './years.ts'

// Creates the contest in the current year, and returns its ID
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

// Publishes a new current year with a contest in it
export const createContestInNewYear = async (
  addYear: AddYear,
): Promise<{ contestId: string; year: number }> => {
  const year = await addYear({ published: true })
  const contestId = await addContest(await createEducator(), `Period 2 Biology`)
  return { contestId, year }
}

// Creates a player named Maya R. in the contest, and returns the player's ID
// and personal link's secret
export const addPlayer = async (
  contestId: string,
): Promise<{ id: string; secret: string }> => {
  const player = await createPlayer(contestId, `Maya R.`, () =>
    Promise.resolve(undefined),
  )
  if (!(`secret` in player)) {
    throw new Error(`The contest refused the player: ${player.refusal}`)
  }
  const { id } = (await readContestPlayer(contestId, player.secret))!
  return { id, secret: player.secret }
}

// Publishes a new current year, creates a player in a contest there, and
// returns the player's ID and the year
export const createPlayerInNewYear = async (
  addYear: AddYear,
): Promise<{ playerId: string; year: number }> => {
  const { contestId, year } = await createContestInNewYear(addYear)
  const { id } = await addPlayer(contestId)
  return { playerId: id, year }
}
