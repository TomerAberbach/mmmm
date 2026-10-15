import { expect, test } from 'vitest'
import { BRACKET_2025 } from '../prisma/brackets.ts'
import {
  buildBracketView,
  describeBattle,
  readDivisionBattles,
  readStartingRound,
} from './bracket-view.ts'

// 2025's wild card fills seed 14 of SAME & DIFFERENT, which plays seed 3 in its
// division's sixth Round 1 battle
const WILD_CARD_ROUND_1_INDEX = 5

test(`Round 1 pairs each division's seeds in NCAA order`, () => {
  const view = buildBracketView(2025, BRACKET_2025, [])

  const firstBattle = readDivisionBattles(view, `ROUND_1`, `BOTTOM_LEFT`)[0]

  expect(firstBattle?.sides).toStrictEqual([
    { kind: `combatant`, name: `Addax`, seed: 1 },
    { kind: `combatant`, name: `Grant’s Golden Mole`, seed: 16 },
  ])
})

test(`the wild card's seed waits on the wild card until it's decided`, () => {
  const view = buildBracketView(2025, BRACKET_2025, [])

  const battle = view.battles.ROUND_1[WILD_CARD_ROUND_1_INDEX]

  expect(battle?.sides[1]).toStrictEqual({
    kind: `undecided`,
    battle: { round: `WILD_CARD`, index: 0 },
  })
})

test(`the wild card's winner takes the wild card's seed in Round 1`, () => {
  const view = buildBracketView(2025, BRACKET_2025, [
    { battle: { round: `WILD_CARD`, index: 0 }, winner: `Flying Frog` },
  ])

  const battle = view.battles.ROUND_1[WILD_CARD_ROUND_1_INDEX]

  expect(battle?.sides[1]).toStrictEqual({
    kind: `combatant`,
    name: `Flying Frog`,
    seed: 14,
  })
})

test(`a battle's winner moves on with their seed`, () => {
  const view = buildBracketView(2025, BRACKET_2025, [
    { battle: { round: `ROUND_1`, index: 1 }, winner: `Eastern Grey Kangaroo` },
  ])

  const nextBattle = view.battles.ROUND_2[0]

  expect(nextBattle?.sides).toStrictEqual([
    { kind: `undecided`, battle: { round: `ROUND_1`, index: 0 } },
    { kind: `combatant`, name: `Eastern Grey Kangaroo`, seed: 9 },
  ])
})

test.each([
  { scenario: `no combatant in the bracket`, winner: `Okapi` },
  { scenario: `a combatant from another battle`, winner: `Gelada` },
])(`a result naming $scenario throws`, ({ winner }) => {
  const results = [{ battle: { round: `ROUND_1` as const, index: 0 }, winner }]

  expect(() => buildBracketView(2025, BRACKET_2025, results)).toThrow(
    `${winner} isn't in Round 1, battle 1`,
  )
})

test.each([
  {
    scenario: `an undecided battle names the battles that feed it`,
    results: [],
    round: `ROUND_2` as const,
    index: 2,
    description: `Round 2, battle 3: winner of Round 1, battle 5 vs. winner of Round 1, battle 6`,
  },
  {
    scenario: `a decided battle names its winner`,
    results: [
      { battle: { round: `ROUND_1` as const, index: 1 }, winner: `Gelada` },
    ],
    round: `ROUND_1` as const,
    index: 1,
    description: `Round 1, battle 2: Gelada vs. Eastern Grey Kangaroo, Gelada won`,
  },
  {
    scenario: `a seed the wild card fills names the wild card`,
    results: [],
    round: `ROUND_1` as const,
    index: WILD_CARD_ROUND_1_INDEX,
    description: `Round 1, battle 6: Sunda Colugo vs. winner of the wild card`,
  },
  {
    scenario: `the wild card lists its entrants`,
    results: [],
    round: `WILD_CARD` as const,
    index: 0,
    description: `Wild card: Northern Flying Squirrel vs. Flying Frog`,
  },
])(`$scenario`, ({ results, round, index, description }) => {
  const view = buildBracketView(2025, BRACKET_2025, results)

  const battle = view.battles[round][index]!

  expect(describeBattle(battle)).toBe(description)
})

test(`the starting round is Round 1 while it has battles to decide`, () => {
  const view = buildBracketView(2025, BRACKET_2025, [
    { battle: { round: `WILD_CARD`, index: 0 }, winner: `Flying Frog` },
  ])

  expect(readStartingRound(view)).toBe(`ROUND_1`)
})
