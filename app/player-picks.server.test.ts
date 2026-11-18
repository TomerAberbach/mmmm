import { expect, test } from 'vitest'
import { createPlayerInNewYear } from '../test/contests.ts'
import {
  CHAMPIONSHIP,
  findCombatantId,
  pickEveryBattle,
  ROUND_1_FIRST,
} from '../test/picks.ts'
import { addClaimedYear, withCurrentYear } from '../test/years.ts'
import type { AddYear } from '../test/years.ts'
import { buildBracketView } from './bracket-view.ts'
import { readBracket, renameCombatant } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import { pickWinner } from './picks.ts'
import type { Picks } from './picks.ts'
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

// The year's stored bracket, which `addYear` fills with 2026's
const readSeededBracket = async (year: number) =>
  toSeededBracket((await readBracket(year))!)

type TestPicks = {
  // Round 1's first battle's seed 1, picked in `complete`
  nileCrocodile: string
  complete: Picks
  // The complete picks with Round 1's first battle changed, which clears the
  // later picks of its first winner
  changed: Picks
  completeChanged: Picks
}

// Picks in the year's bracket, with its stored combatants' IDs
const makeTestPicks = async (year: number): Promise<TestPicks> => {
  const bracket = await readSeededBracket(year)
  const papyrus = findCombatantId(bracket, `Papyrus`)
  const complete = pickEveryBattle(bracket)
  const changed = pickWinner(bracket, complete, ROUND_1_FIRST, papyrus).picks
  return {
    nileCrocodile: findCombatantId(bracket, `Nile Crocodile`),
    complete,
    changed,
    completeChanged: pickWinner(bracket, changed, CHAMPIONSHIP, papyrus).picks,
  }
}

// Creates a player in a new current year, with picks in its bracket
const createPlayerWithPicks = async (addYear: AddYear) => {
  const { playerId, year } = await createPlayerInNewYear(addYear)
  return { playerId, year, picks: await makeTestPicks(year) }
}

test(`a saved draft reads back, with no submission`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)

    const saved = await savePlayerDraft(playerId, year, picks.changed)

    expect(saved).toStrictEqual({ saved: true })
    await expect(readDraftAndSubmission(playerId)).resolves.toStrictEqual({
      draft: picks.changed,
      submission: null,
    })
  }))

test(`saving a draft replaces the earlier one`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)
    await savePlayerDraft(playerId, year, picks.complete)
    const fewerPicks = { 'ROUND_1:0': picks.nileCrocodile }

    await savePlayerDraft(playerId, year, fewerPicks)

    const { draft } = await readDraftAndSubmission(playerId)
    expect(draft).toStrictEqual(fewerPicks)
  }))

test(`a draft that doesn't fit the bracket isn't saved`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)

    const saved = await savePlayerDraft(playerId, year, {
      'ROUND_2:0': picks.nileCrocodile,
    })

    expect(saved).toStrictEqual({ refusal: `INCONSISTENT` })
    const { draft } = await readDraftAndSubmission(playerId)
    expect(draft).toStrictEqual({})
  }))

test(`submitting complete picks makes a pending submission of them`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)

    const submitted = await submitPlayerPicks(playerId, year, picks.complete)

    expect(submitted).toMatchObject({
      submission: { status: `PENDING`, picks: picks.complete },
    })
    await expect(readDraftAndSubmission(playerId)).resolves.toMatchObject({
      draft: picks.complete,
      submission: { status: `PENDING`, picks: picks.complete },
    })
  }))

test.each([
  { scenario: `incomplete`, choosePicks: (picks: TestPicks) => picks.changed },
  {
    scenario: `inconsistent`,
    choosePicks: (picks: TestPicks) => ({
      ...picks.complete,
      'ROUND_2:0': `not-a-combatant`,
    }),
  },
])(`$scenario picks aren't submitted`, ({ choosePicks }) =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)

    const submitted = await submitPlayerPicks(
      playerId,
      year,
      choosePicks(picks),
    )

    expect(submitted).toStrictEqual({ refusal: `INCOMPLETE` })
    const { submission: stored } = await readDraftAndSubmission(playerId)
    expect(stored).toBeNull()
  }),
)

test(`saving a draft after submitting leaves the submission as it was`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)
    await submitPlayerPicks(playerId, year, picks.complete)

    await savePlayerDraft(playerId, year, picks.changed)

    await expect(readDraftAndSubmission(playerId)).resolves.toMatchObject({
      draft: picks.changed,
      submission: { picks: picks.complete },
    })
  }))

test(`submitting changes keeps the submission's approval and records when its picks changed`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)
    const first = await submitPlayerPicks(playerId, year, picks.complete)
    await prisma.submission.update({
      where: { playerId },
      data: { status: `APPROVED` },
    })

    const second = await submitPlayerPicks(
      playerId,
      year,
      picks.completeChanged,
    )

    expect(second).toMatchObject({
      submission: { status: `APPROVED`, picks: picks.completeChanged },
    })
    expect(readPicksChangedAt(second).getTime()).toBeGreaterThan(
      readPicksChangedAt(first).getTime(),
    )
  }))

test(`submitting unchanged picks keeps when the picks last changed`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)
    const first = await submitPlayerPicks(playerId, year, picks.complete)

    const second = await submitPlayerPicks(playerId, year, picks.complete)

    expect(readPicksChangedAt(second)).toStrictEqual(readPicksChangedAt(first))
  }))

test(`discarding the draft brings back the submitted picks`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)
    await submitPlayerPicks(playerId, year, picks.complete)
    await savePlayerDraft(playerId, year, picks.changed)

    const discarded = await discardPlayerDraft(playerId, year)

    expect(discarded).toStrictEqual({ discarded: true })
    const { draft } = await readDraftAndSubmission(playerId)
    expect(draft).toStrictEqual(picks.complete)
  }))

test(`discarding a draft that was never submitted changes nothing`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)
    await savePlayerDraft(playerId, year, picks.changed)

    const discarded = await discardPlayerDraft(playerId, year)

    expect(discarded).toStrictEqual({ refusal: `NOT_SUBMITTED` })
    const { draft } = await readDraftAndSubmission(playerId)
    expect(draft).toStrictEqual(picks.changed)
  }))

test.each([
  {
    scenario: `saving a draft`,
    write: (playerId: string, year: number, picks: TestPicks) =>
      savePlayerDraft(playerId, year, { 'ROUND_1:0': picks.nileCrocodile }),
  },
  {
    scenario: `submitting`,
    write: (playerId: string, year: number, picks: TestPicks) =>
      submitPlayerPicks(playerId, year, picks.completeChanged),
  },
  {
    scenario: `discarding the draft`,
    write: (playerId: string, year: number) =>
      discardPlayerDraft(playerId, year),
  },
])(`$scenario changes nothing once a newer year is published`, ({ write }) =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)
    await submitPlayerPicks(playerId, year, picks.complete)
    await savePlayerDraft(playerId, year, picks.changed)
    await addYear({ published: true })

    const result = await write(playerId, year, picks)

    expect(result).toStrictEqual({ refusal: `NOT_CURRENT_YEAR` })
    await expect(readDraftAndSubmission(playerId)).resolves.toMatchObject({
      draft: picks.changed,
      submission: { picks: picks.complete },
    })
  }),
)

test(`a draft picking another year's combatant isn't saved`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year } = await createPlayerInNewYear(addYear)
    const otherBracket = await readSeededBracket(
      await addClaimedYear({ published: true }),
    )
    const otherNileCrocodile = findCombatantId(otherBracket, `Nile Crocodile`)

    const saved = await savePlayerDraft(playerId, year, {
      'ROUND_1:0': otherNileCrocodile,
    })

    expect(saved).toStrictEqual({ refusal: `INCONSISTENT` })
  }))

test(`picks made before a combatant's rename still save`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)
    await renameCombatant(year, picks.nileCrocodile, `Nile Croc`)

    const saved = await savePlayerDraft(playerId, year, picks.complete)

    expect(saved).toStrictEqual({ saved: true })
  }))

test(`a renamed combatant's picks show the new name`, () =>
  withCurrentYear(async addYear => {
    const { playerId, year, picks } = await createPlayerWithPicks(addYear)
    await savePlayerDraft(playerId, year, picks.complete)

    await renameCombatant(year, picks.nileCrocodile, `Nile Croc`)

    const { draft } = await readDraftAndSubmission(playerId)
    const view = buildBracketView(year, await readSeededBracket(year), draft)
    expect(view.battles.ROUND_1[0]?.winner?.name).toBe(`Nile Croc`)
  }))
