import { expect, test } from 'vitest'
import { BRACKET_2025 } from '../prisma/brackets.ts'
import { toBattleKey } from './bracket.ts'
import type { BattleRef } from './bracket.ts'
import {
  arePicksConsistent,
  listContenders,
  pickWinner,
  toPickBracket,
} from './picks.ts'

const BRACKET = toPickBracket(BRACKET_2025)

const ROUND_1_FIRST: BattleRef = { round: `ROUND_1`, index: 0 }
const ROUND_2_FIRST: BattleRef = { round: `ROUND_2`, index: 0 }
const CHAMPIONSHIP: BattleRef = { round: `CHAMPIONSHIP`, index: 0 }
// 2025's wild card fills seed 14 of the top left division, which plays seed 3
const WILD_CARD_ROUND_1: BattleRef = { round: `ROUND_1`, index: 5 }

const [SEED_1 = ``, SEED_16 = ``] = listContenders(BRACKET, ROUND_1_FIRST)

test(`picking a Round 1 winner picks only that battle`, () => {
  const { picks, cleared } = pickWinner(BRACKET, {}, ROUND_1_FIRST, SEED_1)

  expect(picks).toStrictEqual({ [toBattleKey(ROUND_1_FIRST)]: SEED_1 })
  expect(cleared).toStrictEqual([])
})

test(`picking a champion also picks every earlier win on its way there`, () => {
  const { picks } = pickWinner(BRACKET, {}, CHAMPIONSHIP, SEED_16)

  expect(picks).toStrictEqual({
    'ROUND_1:0': SEED_16,
    'ROUND_2:0': SEED_16,
    'SWEET_16:0': SEED_16,
    'ELITE_TRAIT:0': SEED_16,
    'FINAL_ROAR:0': SEED_16,
    'CHAMPIONSHIP:0': SEED_16,
  })
})

test(`picking a wild card entrant past Round 1 also picks the wild card`, () => {
  const [entrant = ``] = BRACKET.wildCardEntrants

  const { picks } = pickWinner(BRACKET, {}, WILD_CARD_ROUND_1, entrant)

  expect(picks).toStrictEqual({
    'WILD_CARD:0': entrant,
    'ROUND_1:5': entrant,
  })
})

test(`changing a pick clears the later picks that depended on it`, () => {
  const { picks: championPicks } = pickWinner(BRACKET, {}, CHAMPIONSHIP, SEED_1)

  const { picks, cleared } = pickWinner(
    BRACKET,
    championPicks,
    ROUND_1_FIRST,
    SEED_16,
  )

  expect(picks).toStrictEqual({ 'ROUND_1:0': SEED_16 })
  expect(cleared.map(toBattleKey)).toStrictEqual([
    `ROUND_2:0`,
    `SWEET_16:0`,
    `ELITE_TRAIT:0`,
    `FINAL_ROAR:0`,
    `CHAMPIONSHIP:0`,
  ])
})

test(`changing a pick keeps the later picks that don't depend on it`, () => {
  const [otherWinner = ``] = listContenders(BRACKET, {
    round: `ROUND_1`,
    index: 1,
  })
  const { picks: before } = pickWinner(BRACKET, {}, ROUND_2_FIRST, otherWinner)

  const { picks, cleared } = pickWinner(BRACKET, before, ROUND_1_FIRST, SEED_1)

  expect(picks[toBattleKey(ROUND_2_FIRST)]).toBe(otherWinner)
  expect(cleared).toStrictEqual([])
})

test(`a combatant who can't reach a battle can't be picked to win it`, () => {
  expect(() =>
    pickWinner(BRACKET, {}, ROUND_1_FIRST, `Not a combatant`),
  ).toThrow(`Not a combatant can't reach ROUND_1:0`)
})

test(`a battle lists every combatant who could win it`, () => {
  const contenders = listContenders(BRACKET, ROUND_2_FIRST)

  expect(contenders).toStrictEqual([
    SEED_1,
    SEED_16,
    `Gelada`,
    `Eastern Grey Kangaroo`,
  ])
})

test.each([
  {
    scenario: `picks made by picking winners`,
    picks: pickWinner(BRACKET, {}, CHAMPIONSHIP, SEED_1).picks,
    consistent: true,
  },
  {
    scenario: `a winner who isn't on its battle's sides`,
    picks: { 'ROUND_2:0': SEED_1 },
    consistent: false,
  },
  {
    scenario: `a battle that doesn't exist`,
    picks: { 'ROUND_9:0': SEED_1 },
    consistent: false,
  },
])(`$scenario are consistent: $consistent`, ({ picks, consistent }) => {
  expect(arePicksConsistent(BRACKET, picks)).toBe(consistent)
})
