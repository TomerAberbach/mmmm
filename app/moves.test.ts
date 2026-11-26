import { expect, test } from 'vitest'
import { BRACKET_2025, BRACKET_2026 } from '../prisma/brackets.ts'
import { storeTestBracket } from '../test/picks.ts'
import { toBattleKey } from './bracket.ts'
import {
  listDisturbedBattles,
  readArrangement,
  swapCombatants,
} from './moves.ts'
import type { Swap } from './moves.ts'
import { toSeededBracket } from './seeded-bracket.ts'
import type { StoredBracket } from './seeded-bracket.ts'

const BRACKET = storeTestBracket(BRACKET_2026)
const { entrants } = BRACKET.wildCard
const [SEED_1, SEED_2] = BRACKET.divisions.TOP_LEFT.combatants
const SEED_16 = BRACKET.divisions.TOP_LEFT.combatants.at(-1)!

const listDisturbedKeys = (
  swaps: Swap[],
  bracket: StoredBracket = BRACKET,
): string[] =>
  listDisturbedBattles(
    toSeededBracket(bracket),
    toSeededBracket(swapCombatants(bracket, swaps)!),
  ).map(toBattleKey)

test(`swapped combatants take each other's place`, () => {
  const swapped = swapCombatants(BRACKET, [[SEED_1!.id, SEED_2!.id]])

  expect(swapped?.divisions.TOP_LEFT.combatants.slice(0, 2)).toStrictEqual([
    SEED_2,
    SEED_1,
  ])
})

test(`swapping back restores the arrangement`, () => {
  const swap: Swap = [SEED_1!.id, entrants[0]!.id]

  const swapped = swapCombatants(BRACKET, [swap, swap])

  expect(readArrangement(swapped!)).toBe(readArrangement(BRACKET))
})

test(`a combatant without a place can't be swapped`, () => {
  expect(swapCombatants(BRACKET, [[SEED_1!.id, `merge`]])).toBeNull()
})

test(`swapping a battle's own sides disturbs nothing`, () => {
  expect(listDisturbedKeys([[SEED_1!.id, SEED_16.id]])).toStrictEqual([])
})

test(`swapping the wild card's entrants disturbs nothing`, () => {
  expect(listDisturbedKeys([[entrants[0]!.id, entrants[1]!.id]])).toStrictEqual(
    [],
  )
})

test(`swapping two battles' combatants disturbs them and every battle their winners reach`, () => {
  // Seed 1 plays the division's first battle and seed 2 its last
  expect(listDisturbedKeys([[SEED_1!.id, SEED_2!.id]])).toStrictEqual([
    `ROUND_1:0`,
    `ROUND_1:7`,
    `ROUND_2:0`,
    `ROUND_2:3`,
    `SWEET_16:0`,
    `SWEET_16:1`,
    `ELITE_TRAIT:0`,
    `FINAL_ROAR:0`,
    `CHAMPIONSHIP:0`,
  ])
})

test(`swapping a wild card entrant with a seed disturbs the wild card and where it leads`, () => {
  // 2025's wild card fills a seed of the top left division
  const bracket = storeTestBracket(BRACKET_2025)
  const seed1 = bracket.divisions.TOP_LEFT.combatants[0]!

  const keys = listDisturbedKeys(
    [[seed1.id, bracket.wildCard.entrants[0]!.id]],
    bracket,
  )

  expect(keys.slice(0, 3)).toStrictEqual([
    `WILD_CARD:0`,
    `ROUND_1:0`,
    `ROUND_1:5`,
  ])
})
