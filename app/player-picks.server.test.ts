import { expect, test } from 'vitest'
import { BRACKET_2026 } from '../prisma/brackets.ts'
import { createEducator } from '../test/educators.ts'
import { pickEveryBattle } from '../test/picks.ts'
import { createBracket, setBracketPublished } from './brackets.server.ts'
import { createContest } from './contests.server.ts'
import { prisma } from './db.server.ts'
import { listContenders, pickWinner, toPickBracket } from './picks.ts'
import {
  discardPlayerDraft,
  readDraftAndSubmission,
  savePlayerDraft,
  submitPlayerPicks,
} from './player-picks.server.ts'
import { createPlayer, readContestPlayer } from './players.server.ts'

// The test database is shared across this run, so this file uses years of its
// own, below the ones brackets.server.test.ts publishes as the current year
let nextYear = 2400

// Creates a player in a new year's contest
const createPlayerInNewYear = async (): Promise<{
  playerId: string
  year: number
}> => {
  const year = nextYear++
  await createBracket(year, BRACKET_2026)
  await setBracketPublished(year, true)
  const contestId = await createContest(
    await createEducator(),
    year,
    `Period 2 Biology`,
  )
  const secret = await createPlayer(contestId!, `Maya R.`)
  const player = await readContestPlayer(contestId!, secret)
  return { playerId: player!.id, year }
}

const BRACKET = toPickBracket(BRACKET_2026)

const COMPLETE_PICKS = pickEveryBattle(BRACKET)
const [FIRST_SEED = ``, SECOND_SEED = ``] = listContenders(BRACKET, {
  round: `ROUND_1`,
  index: 0,
})
// The complete picks with Round 1's first battle changed, which clears the
// later picks of its first winner
const CHANGED_PICKS = pickWinner(
  BRACKET,
  COMPLETE_PICKS,
  { round: `ROUND_1`, index: 0 },
  SECOND_SEED,
).picks
const COMPLETE_CHANGED_PICKS = pickWinner(
  BRACKET,
  CHANGED_PICKS,
  { round: `CHAMPIONSHIP`, index: 0 },
  SECOND_SEED,
).picks

test(`a saved draft reads back, with no submission`, async () => {
  const { playerId, year } = await createPlayerInNewYear()

  const saved = await savePlayerDraft(playerId, year, CHANGED_PICKS)

  expect(saved).toBe(true)
  await expect(readDraftAndSubmission(playerId)).resolves.toStrictEqual({
    draft: CHANGED_PICKS,
    submission: null,
  })
})

test(`saving a draft replaces the earlier one`, async () => {
  const { playerId, year } = await createPlayerInNewYear()
  await savePlayerDraft(playerId, year, COMPLETE_PICKS)
  const fewerPicks = { 'ROUND_1:0': FIRST_SEED }

  await savePlayerDraft(playerId, year, fewerPicks)

  const { draft } = await readDraftAndSubmission(playerId)
  expect(draft).toStrictEqual(fewerPicks)
})

test(`a draft that doesn't fit the bracket isn't saved`, async () => {
  const { playerId, year } = await createPlayerInNewYear()

  const saved = await savePlayerDraft(playerId, year, {
    'ROUND_2:0': FIRST_SEED,
  })

  expect(saved).toBe(false)
  const { draft } = await readDraftAndSubmission(playerId)
  expect(draft).toStrictEqual({})
})

test(`submitting complete picks makes a pending submission of them`, async () => {
  const { playerId, year } = await createPlayerInNewYear()

  const submission = await submitPlayerPicks(playerId, year, COMPLETE_PICKS)

  expect(submission).toMatchObject({
    status: `PENDING`,
    picks: COMPLETE_PICKS,
  })
  await expect(readDraftAndSubmission(playerId)).resolves.toMatchObject({
    draft: COMPLETE_PICKS,
    submission: { status: `PENDING`, picks: COMPLETE_PICKS },
  })
})

test.each([
  { scenario: `incomplete`, picks: CHANGED_PICKS },
  {
    scenario: `inconsistent`,
    picks: { ...COMPLETE_PICKS, 'ROUND_2:0': `Okapi` },
  },
])(`$scenario picks aren't submitted`, async ({ picks }) => {
  const { playerId, year } = await createPlayerInNewYear()

  const submission = await submitPlayerPicks(playerId, year, picks)

  expect(submission).toBeNull()
  const { submission: stored } = await readDraftAndSubmission(playerId)
  expect(stored).toBeNull()
})

test(`saving a draft after submitting leaves the submission as it was`, async () => {
  const { playerId, year } = await createPlayerInNewYear()
  await submitPlayerPicks(playerId, year, COMPLETE_PICKS)

  await savePlayerDraft(playerId, year, CHANGED_PICKS)

  await expect(readDraftAndSubmission(playerId)).resolves.toMatchObject({
    draft: CHANGED_PICKS,
    submission: { picks: COMPLETE_PICKS },
  })
})

test(`submitting changes keeps the submission's approval and records when its picks changed`, async () => {
  const { playerId, year } = await createPlayerInNewYear()
  const first = await submitPlayerPicks(playerId, year, COMPLETE_PICKS)
  await prisma.submission.update({
    where: { playerId },
    data: { status: `APPROVED` },
  })

  const second = await submitPlayerPicks(playerId, year, COMPLETE_CHANGED_PICKS)

  expect(second).toMatchObject({
    status: `APPROVED`,
    picks: COMPLETE_CHANGED_PICKS,
  })
  expect(second!.picksChangedAt.getTime()).toBeGreaterThan(
    first!.picksChangedAt.getTime(),
  )
})

test(`submitting unchanged picks keeps when the picks last changed`, async () => {
  const { playerId, year } = await createPlayerInNewYear()
  const first = await submitPlayerPicks(playerId, year, COMPLETE_PICKS)

  const second = await submitPlayerPicks(playerId, year, COMPLETE_PICKS)

  expect(second!.picksChangedAt).toStrictEqual(first!.picksChangedAt)
})

test(`discarding the draft brings back the submitted picks`, async () => {
  const { playerId, year } = await createPlayerInNewYear()
  await submitPlayerPicks(playerId, year, COMPLETE_PICKS)
  await savePlayerDraft(playerId, year, CHANGED_PICKS)

  const discarded = await discardPlayerDraft(playerId)

  expect(discarded).toBe(true)
  const { draft } = await readDraftAndSubmission(playerId)
  expect(draft).toStrictEqual(COMPLETE_PICKS)
})

test(`discarding a draft that was never submitted changes nothing`, async () => {
  const { playerId, year } = await createPlayerInNewYear()
  await savePlayerDraft(playerId, year, CHANGED_PICKS)

  const discarded = await discardPlayerDraft(playerId)

  expect(discarded).toBe(false)
  const { draft } = await readDraftAndSubmission(playerId)
  expect(draft).toStrictEqual(CHANGED_PICKS)
})
