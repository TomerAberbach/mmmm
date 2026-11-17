import { expect, test } from 'vitest'
import { BRACKET_2026 } from '../prisma/brackets.ts'
import { createPlayerInNewYear } from '../test/contests.ts'
import { pickEveryBattle } from '../test/picks.ts'
import { withCurrentYear } from '../test/years.ts'
import { prisma } from './db.server.ts'
import { listContenders, pickWinner } from './picks.ts'
import {
  discardPlayerDraft,
  readDraftAndSubmission,
  savePlayerDraft,
  submitPlayerPicks,
} from './player-picks.server.ts'
import { toSeededBracket } from './seeded-bracket.ts'

const readPicksChangedAt = (
  submitted: Awaited<ReturnType<typeof submitPlayerPicks>>,
): Date => {
  if (!(`submission` in submitted)) {
    throw new Error(`The picks weren't submitted: ${submitted.refusal}`)
  }
  return submitted.submission.picksChangedAt
}

const BRACKET = toSeededBracket(BRACKET_2026)

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

test(`a saved draft reads back, with no submission`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year } = await createPlayerInNewYear(addYear)

    const saved = await savePlayerDraft(playerId, year, CHANGED_PICKS)

    expect(saved).toStrictEqual({ saved: true })
    await expect(readDraftAndSubmission(playerId)).resolves.toStrictEqual({
      draft: CHANGED_PICKS,
      submission: null,
    })
  }))

test(`saving a draft replaces the earlier one`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year } = await createPlayerInNewYear(addYear)
    await savePlayerDraft(playerId, year, COMPLETE_PICKS)
    const fewerPicks = { 'ROUND_1:0': FIRST_SEED }

    await savePlayerDraft(playerId, year, fewerPicks)

    const { draft } = await readDraftAndSubmission(playerId)
    expect(draft).toStrictEqual(fewerPicks)
  }))

test(`a draft that doesn't fit the bracket isn't saved`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year } = await createPlayerInNewYear(addYear)

    const saved = await savePlayerDraft(playerId, year, {
      'ROUND_2:0': FIRST_SEED,
    })

    expect(saved).toStrictEqual({ refusal: `INCONSISTENT` })
    const { draft } = await readDraftAndSubmission(playerId)
    expect(draft).toStrictEqual({})
  }))

test(`submitting complete picks makes a pending submission of them`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year } = await createPlayerInNewYear(addYear)

    const submitted = await submitPlayerPicks(playerId, year, COMPLETE_PICKS)

    expect(submitted).toMatchObject({
      submission: { status: `PENDING`, picks: COMPLETE_PICKS },
    })
    await expect(readDraftAndSubmission(playerId)).resolves.toMatchObject({
      draft: COMPLETE_PICKS,
      submission: { status: `PENDING`, picks: COMPLETE_PICKS },
    })
  }))

test.each([
  { scenario: `incomplete`, picks: CHANGED_PICKS },
  {
    scenario: `inconsistent`,
    picks: { ...COMPLETE_PICKS, 'ROUND_2:0': `Okapi` },
  },
])(`$scenario picks aren't submitted`, ({ picks }) =>
  withCurrentYear(async addYear => {
    const { playerId, year } = await createPlayerInNewYear(addYear)

    const submitted = await submitPlayerPicks(playerId, year, picks)

    expect(submitted).toStrictEqual({ refusal: `INCOMPLETE` })
    const { submission: stored } = await readDraftAndSubmission(playerId)
    expect(stored).toBeNull()
  }),
)

test(`saving a draft after submitting leaves the submission as it was`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year } = await createPlayerInNewYear(addYear)
    await submitPlayerPicks(playerId, year, COMPLETE_PICKS)

    await savePlayerDraft(playerId, year, CHANGED_PICKS)

    await expect(readDraftAndSubmission(playerId)).resolves.toMatchObject({
      draft: CHANGED_PICKS,
      submission: { picks: COMPLETE_PICKS },
    })
  }))

test(`submitting changes keeps the submission's approval and records when its picks changed`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year } = await createPlayerInNewYear(addYear)
    const first = await submitPlayerPicks(playerId, year, COMPLETE_PICKS)
    await prisma.submission.update({
      where: { playerId },
      data: { status: `APPROVED` },
    })

    const second = await submitPlayerPicks(
      playerId,
      year,
      COMPLETE_CHANGED_PICKS,
    )

    expect(second).toMatchObject({
      submission: { status: `APPROVED`, picks: COMPLETE_CHANGED_PICKS },
    })
    expect(readPicksChangedAt(second).getTime()).toBeGreaterThan(
      readPicksChangedAt(first).getTime(),
    )
  }))

test(`submitting unchanged picks keeps when the picks last changed`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year } = await createPlayerInNewYear(addYear)
    const first = await submitPlayerPicks(playerId, year, COMPLETE_PICKS)

    const second = await submitPlayerPicks(playerId, year, COMPLETE_PICKS)

    expect(readPicksChangedAt(second)).toStrictEqual(readPicksChangedAt(first))
  }))

test(`discarding the draft brings back the submitted picks`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year } = await createPlayerInNewYear(addYear)
    await submitPlayerPicks(playerId, year, COMPLETE_PICKS)
    await savePlayerDraft(playerId, year, CHANGED_PICKS)

    const discarded = await discardPlayerDraft(playerId, year)

    expect(discarded).toStrictEqual({ discarded: true })
    const { draft } = await readDraftAndSubmission(playerId)
    expect(draft).toStrictEqual(COMPLETE_PICKS)
  }))

test(`discarding a draft that was never submitted changes nothing`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year } = await createPlayerInNewYear(addYear)
    await savePlayerDraft(playerId, year, CHANGED_PICKS)

    const discarded = await discardPlayerDraft(playerId, year)

    expect(discarded).toStrictEqual({ refusal: `NOT_SUBMITTED` })
    const { draft } = await readDraftAndSubmission(playerId)
    expect(draft).toStrictEqual(CHANGED_PICKS)
  }))

test.each([
  {
    scenario: `saving a draft`,
    write: (playerId: string, year: number) =>
      savePlayerDraft(playerId, year, { 'ROUND_1:0': FIRST_SEED }),
  },
  {
    scenario: `submitting`,
    write: (playerId: string, year: number) =>
      submitPlayerPicks(playerId, year, COMPLETE_CHANGED_PICKS),
  },
  {
    scenario: `discarding the draft`,
    write: (playerId: string, year: number) =>
      discardPlayerDraft(playerId, year),
  },
])(`$scenario changes nothing once a newer year is published`, ({ write }) =>
  withCurrentYear(async addYear => {
    const { playerId, year } = await createPlayerInNewYear(addYear)
    await submitPlayerPicks(playerId, year, COMPLETE_PICKS)
    await savePlayerDraft(playerId, year, CHANGED_PICKS)
    await addYear({ published: true })

    const result = await write(playerId, year)

    expect(result).toStrictEqual({ refusal: `NOT_CURRENT_YEAR` })
    await expect(readDraftAndSubmission(playerId)).resolves.toMatchObject({
      draft: CHANGED_PICKS,
      submission: { picks: COMPLETE_PICKS },
    })
  }),
)
