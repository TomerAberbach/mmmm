import { expect, test } from 'vitest'
import { addContest, addPlayer } from '../prisma/fixtures.ts'
import { pickEveryBattle } from '../prisma/pick-every-battle.ts'
import { createContestInNewYear, readEducatorId } from '../test/contests.ts'
import { readDraftAndSubmission, submitPicks } from '../test/player-picks.ts'
import {
  crownChampion,
  lockYear,
  makeMerge,
  readSeededBracket,
} from '../test/results.ts'
import { readBracket, readResultRows } from './brackets.server.ts'
import {
  readContestPlayers,
  setSubmissionStatus,
} from './contest-players.server.ts'
import type { MoveRequest } from './move-request.ts'
import { moveCombatants, readMoveImpact } from './moves.server.ts'
import { readArrangement } from './moves.ts'
import { reopenSubmissions, saveResult } from './results.server.ts'
import { listMerges } from './seeded-bracket.ts'

/** Swaps the first two seeds of the top left division */
const makeMove = async (
  year: number,
  isLocked = false,
): Promise<MoveRequest> => {
  const bracket = (await readBracket(year))!
  const [first, second] = bracket.divisions.TOP_LEFT.combatants
  return {
    intent: `save`,
    year,
    arrangement: readArrangement(bracket),
    isLocked,
    results: isLocked ? Object.keys(await readResultRows(year)) : [],
    swaps: [[first!.id, second!.id]],
  }
}

const addSubmitted = async (contestId: string, year: number) => {
  const { id } = await addPlayer(contestId)
  await submitPicks(id, pickEveryBattle(await readSeededBracket(year)))
  return id
}

test(`a move takes effect`, async () => {
  const { year } = await createContestInNewYear()
  const move = await makeMove(year)

  const moved = await moveCombatants(move)

  expect(moved).toStrictEqual({ moved: true })
  const { combatants } = (await readBracket(year))!.divisions.TOP_LEFT
  expect(combatants.slice(0, 2).map(({ id }) => id)).toStrictEqual(
    move.swaps[0]!.toReversed(),
  )
})

test(`a move between the wild card and a seed slot takes effect`, async () => {
  const { year } = await createContestInNewYear()
  const bracket = (await readBracket(year))!
  const entrantId = bracket.wildCard.entrants[0]!.id
  const move = await makeMove(year)
  const seedId = move.swaps[0]![0]

  await moveCombatants({ ...move, swaps: [[seedId, entrantId]] })

  const after = (await readBracket(year))!
  expect([
    after.divisions.TOP_LEFT.combatants[0]!.id,
    after.wildCard.entrants[0]!.id,
  ]).toStrictEqual([entrantId, seedId])
})

test(`before the lock, an affected submission returns to a draft with a note`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const id = await addSubmitted(contestId, year)

  await moveCombatants(await makeMove(year))

  const { draft, submission, hasClearedPicks } =
    await readDraftAndSubmission(id)
  expect(submission).toBeNull()
  expect(hasClearedPicks).toBe(true)
  // 64 battles less the 9 the swap disturbs
  expect(Object.keys(draft)).toHaveLength(55)
  await expect(
    readContestPlayers(contestId, `OLDEST_FIRST`),
  ).resolves.toMatchObject([{ status: null }])
})

test(`submitting again removes the note and waits for approval again`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const id = await addSubmitted(contestId, year)
  await setSubmissionStatus(
    await readEducatorId(contestId),
    contestId,
    [id],
    `APPROVED`,
  )
  await moveCombatants(await makeMove(year))

  await submitPicks(id, pickEveryBattle(await readSeededBracket(year)))

  await expect(readDraftAndSubmission(id)).resolves.toMatchObject({
    submission: { status: `PENDING` },
    hasClearedPicks: false,
  })
})

test(`after the lock, a submission keeps its other picks and loses its points`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const id = await addSubmitted(contestId, year)
  await crownChampion(year)

  await moveCombatants(await makeMove(year, true))

  const { submission, hasClearedPicks } = await readDraftAndSubmission(id)
  expect(Object.keys(submission!.picks)).toHaveLength(55)
  // The note shows if submissions reopen
  expect(hasClearedPicks).toBe(true)
  await expect(readResultRows(year)).resolves.toStrictEqual({})
  await expect(
    readContestPlayers(contestId, `OLDEST_FIRST`),
  ).resolves.toMatchObject([{ score: 0 }])
})

test(`a merge goes with its cleared result`, async () => {
  const { year } = await createContestInNewYear()
  await saveResult(await makeMerge(year))

  await moveCombatants(await makeMove(year, true))

  expect(listMerges(await readSeededBracket(year))).toStrictEqual([])
})

test(`the preview counts what a move clears`, async () => {
  const { contestId, year } = await createContestInNewYear()
  await addSubmitted(contestId, year)
  await addPlayer(contestId)
  await addContest(await readEducatorId(contestId), `Period 5 Biology`)
  await lockYear(year)

  const impact = await readMoveImpact(await makeMove(year, true))

  expect(impact).toStrictEqual({
    battles: 9,
    submissions: 1,
    drafts: 0,
    results: [`ROUND_1:0`],
  })
})

test.each<[string, Partial<MoveRequest>]>([
  [`made of another arrangement`, { arrangement: `` }],
  [`made before the lock changed`, { isLocked: true }],
  [`that clears other results`, { results: [`ROUND_1:0`] }],
  [`of another year`, { year: 1999 }],
  [`of a missing combatant`, { swaps: [[`someone`, `else`]] }],
])(`a move %s is refused`, async (_, change) => {
  const { year } = await createContestInNewYear()

  const moved = await moveCombatants({ ...(await makeMove(year)), ...change })

  expect(moved).toStrictEqual({ refusal: `STALE` })
})

test(`reopening returns a submission that lost picks to a draft`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const id = await addSubmitted(contestId, year)
  await crownChampion(year)
  await moveCombatants(await makeMove(year, true))

  const reopened = await reopenSubmissions(year)

  expect(reopened).toBe(`REOPENED`)
  const { submission, draft } = await readDraftAndSubmission(id)
  expect(submission).toBeNull()
  expect(Object.keys(draft)).toHaveLength(55)
})
