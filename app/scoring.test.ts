import { expect, test } from 'vitest'
import { BRACKET_2025 } from '../prisma/brackets.ts'
import {
  CHAMPIONSHIP,
  findCombatantId,
  pickEveryBattle,
  ROUND_1_FIRST,
  seedTestBracket,
} from '../test/picks.ts'
import { buildMarkedBracketView, describeBattle } from './bracket-view.ts'
import type { BattleRef } from './bracket.ts'
import { listContenders } from './picks.ts'
import { recordResult } from './results.ts'
import type { Results } from './results.ts'
import { readScorecard } from './scorecard.ts'
import { markPick, PERFECT_SCORE } from './scoring.ts'

const BRACKET = seedTestBracket(BRACKET_2025)
const PICKS = pickEveryBattle(BRACKET)
const ROUND_2_FIRST: BattleRef = { round: `ROUND_2`, index: 0 }
const [PICKED, OPPONENT] = [PICKS[`ROUND_1:0`]!, PICKS[`ROUND_1:1`]!]
const KANGAROO = findCombatantId(BRACKET, `Eastern Grey Kangaroo`)

const markFirstRound2Pick = (results: Results) =>
  markPick(BRACKET, results, ROUND_2_FIRST, PICKED)

const scorePicks = (results: Results) =>
  readScorecard(buildMarkedBracketView(2025, BRACKET, PICKS, results))

test(`a perfect bracket scores 138`, () => {
  expect(PERFECT_SCORE).toBe(138)
  expect(scorePicks(PICKS)).toMatchObject({
    score: 138,
    possible: 0,
    isFinal: true,
  })
})

test(`a pick that matches the result is right`, () => {
  expect(markFirstRound2Pick({ 'ROUND_2:0': PICKED })).toBe(`RIGHT`)
})

test(`a pick of the loser is wrong`, () => {
  expect(markFirstRound2Pick({ 'ROUND_2:0': OPPONENT })).toBe(`WRONG`)
})

test(`a pick whose winner lost earlier is wrong before its battle is decided`, () => {
  const upset = listContenders(BRACKET, ROUND_1_FIRST)[1]!.id
  const { results } = recordResult(BRACKET, {}, ROUND_1_FIRST, upset)

  expect(markFirstRound2Pick(results)).toBe(`WRONG`)
})

test(`a pick that could still be right is undecided`, () => {
  expect(markFirstRound2Pick({ 'ROUND_1:0': PICKED })).toBe(`UNDECIDED`)
})

test(`before any result, every point is still possible`, () => {
  expect(scorePicks({})).toMatchObject({
    score: 0,
    possible: 138,
    isFinal: false,
  })
})

test(`a wrong pick loses its points and those of its later wins`, () => {
  const { results } = recordResult(
    BRACKET,
    {},
    { round: `ROUND_1`, index: 1 },
    KANGAROO,
  )

  const scorecard = scorePicks(results)

  // The battle's loser was picked to win only that battle
  expect(scorecard).toMatchObject({ score: 0, possible: 137 })
  expect(scorecard.rounds[1]).toStrictEqual({
    round: `ROUND_1`,
    right: 0,
    decided: 1,
    earned: 0,
    possible: 31,
  })
})

test(`the champion earns every round on their way`, () => {
  const champion = PICKS[`CHAMPIONSHIP:0`]!
  const { results } = recordResult(BRACKET, {}, CHAMPIONSHIP, champion)

  expect(scorePicks(results)).toMatchObject({
    score: 1 + 2 + 3 + 5 + 8 + 13,
    isFinal: true,
  })
})

test.each([
  [`right`, { 'ROUND_1:1': OPPONENT }, `right`],
  [`wrong`, { 'ROUND_1:1': KANGAROO }, `wrong, Eastern Grey Kangaroo won`],
  [`not decided yet`, {}, `not decided yet`],
])(`a pick is described as %s`, (_, results: Results, text) => {
  const view = buildMarkedBracketView(2025, BRACKET, PICKS, results)

  const description = describeBattle(view.battles.ROUND_1[1]!)

  expect(description).toBe(
    `Round 1, battle 2: Gelada vs. Eastern Grey Kangaroo. Picked Gelada, ${text}`,
  )
})
