import { expect, test } from 'vitest'
import {
  addPlayer,
  createContestInNewYear,
  readEducatorId,
} from '../test/contests.ts'
import {
  CHAMPIONSHIP,
  pickEveryBattle,
  ROUND_1_FIRST,
  ROUND_2_FIRST,
} from '../test/picks.ts'
import {
  crownChampion,
  makeFirstResult,
  makeMerge,
  readSeededBracket,
} from '../test/results.ts'
import { buildMarkedBracketView } from './bracket-view.ts'
import { readResultRows } from './brackets.server.ts'
import { readContestPlayers } from './contest-players.server.ts'
import { prisma } from './db.server.ts'
import { listContenders, pickWinner } from './picks.ts'
import { submitPlayerPicks } from './player-picks.server.ts'
import { saveResult } from './results.server.ts'
import { readScorecard } from './scorecard.ts'
import { deletePlayers } from './trash.server.ts'

/** Submits the first contender of every battle */
const submitFirstContenders = async (year: number, playerId: string) => {
  const picks = pickEveryBattle(await readSeededBracket(year))
  await submitPlayerPicks(playerId, picks)
  return picks
}

const readScore = async (playerId: string): Promise<number> =>
  (
    await prisma.submission.findUniqueOrThrow({
      where: { playerId },
      select: { score: true },
    })
  ).score

test(`saving a result stores the score the marked bracket shows`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const { id } = await addPlayer(contestId)
  const picks = await submitFirstContenders(year, id)

  await crownChampion(year)

  const view = buildMarkedBracketView(
    year,
    await readSeededBracket(year),
    picks,
    await readResultRows(year),
  )
  const { score } = readScorecard(view)
  expect(score).toBeGreaterThan(0)
  await expect(readScore(id)).resolves.toBe(score)
})

test(`clearing a result takes its points back`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const { id } = await addPlayer(contestId)
  await submitFirstContenders(year, id)
  const request = await makeFirstResult(year)
  await saveResult(request)
  const before = await readScore(id)

  await saveResult({
    ...request,
    winnerId: null,
    previousWinnerId: request.winnerId,
  })

  expect([before, await readScore(id)]).toStrictEqual([1, 0])
})

test(`a submission in the trash is scored, so it can be restored`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const { id } = await addPlayer(contestId)
  await submitFirstContenders(year, id)
  await deletePlayers(await readEducatorId(contestId), contestId, [id])

  await saveResult(await makeFirstResult(year))

  await expect(readScore(id)).resolves.toBe(1)
})

test(`another year's scores stay as they were`, async () => {
  const past = await createContestInNewYear()
  const { id } = await addPlayer(past.contestId)
  await submitFirstContenders(past.year, id)
  await saveResult(await makeFirstResult(past.year))
  const current = await createContestInNewYear()

  await crownChampion(current.year)

  await expect(readScore(id)).resolves.toBe(1)
})

test(`players are listed by score, then by when their picks last changed`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const bracket = await readSeededBracket(year)
  const picks = pickEveryBattle(bracket)
  const upset = listContenders(bracket, ROUND_1_FIRST)[1]!.id
  const upsetPicks = pickWinner(bracket, picks, CHAMPIONSHIP, upset).picks
  const [low, tied, tiedEarlier] = [
    await addPlayer(contestId, `Low`),
    await addPlayer(contestId, `Tied`),
    await addPlayer(contestId, `Tied earlier`),
  ]
  await submitPlayerPicks(low.id, upsetPicks)
  await submitPlayerPicks(tiedEarlier.id, picks)
  await submitPlayerPicks(tied.id, picks)

  await saveResult(await makeFirstResult(year))

  const players = await readContestPlayers(contestId, `HIGHEST_SCORE_FIRST`)
  expect(
    players.map(({ displayName, score }) => [displayName, score]),
  ).toStrictEqual([
    [`Tied earlier`, 1],
    [`Tied`, 1],
    [`Low`, 0],
  ])
})

test(`a pick of either side of a merge scores wherever the merge wins`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const bracket = await readSeededBracket(year)
  const picks = pickEveryBattle(bracket)
  const [first, second] = listContenders(bracket, ROUND_1_FIRST)
  const playerIds = await Promise.all(
    [first, second].map(async combatant => {
      const { id } = await addPlayer(contestId)
      await submitPlayerPicks(
        id,
        pickWinner(bracket, picks, CHAMPIONSHIP, combatant!.id).picks,
      )
      return id
    }),
  )
  const merge = await makeMerge(year)
  await saveResult(merge)

  await saveResult({ ...merge, battle: ROUND_2_FIRST, mergeName: null })

  const scores = await Promise.all(playerIds.map(readScore))
  expect(scores).toStrictEqual([3, 3])
})
