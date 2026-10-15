import { expect, test } from 'vitest'
import {
  BATTLE_COUNTS,
  listBattles,
  readBattleSides,
  readNextBattle,
  ROUNDS,
} from './bracket.ts'
import type { SeedSlotRef } from './bracket.ts'

const WILD_CARD_AT_16: SeedSlotRef = { position: `BOTTOM_LEFT`, seed: 16 }

test(`a bracket has 64 battles: the wild card and 63 more`, () => {
  const battles = listBattles()

  expect(battles).toHaveLength(64)
  expect(
    ROUNDS.map(
      round => battles.filter(battle => battle.round === round).length,
    ),
  ).toStrictEqual(ROUNDS.map(round => BATTLE_COUNTS[round]))
})

test.each([
  { index: 0, sides: [`TOP_LEFT 1`, `TOP_LEFT 16`] },
  { index: 1, sides: [`TOP_LEFT 8`, `TOP_LEFT 9`] },
  { index: 2, sides: [`TOP_LEFT 5`, `TOP_LEFT 12`] },
  { index: 3, sides: [`TOP_LEFT 4`, `TOP_LEFT 13`] },
  { index: 4, sides: [`TOP_LEFT 6`, `TOP_LEFT 11`] },
  { index: 5, sides: [`TOP_LEFT 3`, `TOP_LEFT 14`] },
  { index: 6, sides: [`TOP_LEFT 7`, `TOP_LEFT 10`] },
  { index: 7, sides: [`TOP_LEFT 2`, `TOP_LEFT 15`] },
  { index: 9, sides: [`BOTTOM_LEFT 8`, `BOTTOM_LEFT 9`] },
  { index: 31, sides: [`BOTTOM_RIGHT 2`, `BOTTOM_RIGHT 15`] },
])(`Round 1 battle $index pairs seeds in NCAA order`, ({ index, sides }) => {
  const battleSides = readBattleSides(
    { round: `ROUND_1`, index },
    WILD_CARD_AT_16,
  )

  expect(battleSides.map(describeSide)).toStrictEqual(sides)
})

test(`the wild card's winner takes its seed slot in Round 1`, () => {
  const battleSides = readBattleSides(
    { round: `ROUND_1`, index: 8 },
    WILD_CARD_AT_16,
  )

  expect(battleSides.map(describeSide)).toStrictEqual([
    `BOTTOM_LEFT 1`,
    `winner of WILD_CARD 0`,
  ])
})

test(`a wild card at seed 14, as in 2025, meets the division's 3 seed`, () => {
  const wildCardSlot: SeedSlotRef = { position: `TOP_LEFT`, seed: 14 }

  const next = readNextBattle({ round: `WILD_CARD`, index: 0 }, wildCardSlot)

  expect(next).toStrictEqual({ round: `ROUND_1`, index: 5 })
  expect(
    readBattleSides({ round: `ROUND_1`, index: 5 }, wildCardSlot).map(
      describeSide,
    ),
  ).toStrictEqual([`TOP_LEFT 3`, `winner of WILD_CARD 0`])
})

test.each([
  { round: `ROUND_2`, index: 0, feeders: [`ROUND_1 0`, `ROUND_1 1`] },
  { round: `SWEET_16`, index: 3, feeders: [`ROUND_2 6`, `ROUND_2 7`] },
  {
    round: `FINAL_ROAR`,
    index: 0,
    feeders: [`ELITE_TRAIT 0`, `ELITE_TRAIT 1`],
  },
  {
    round: `CHAMPIONSHIP`,
    index: 0,
    feeders: [`FINAL_ROAR 0`, `FINAL_ROAR 1`],
  },
] as const)(
  `$round battle $index takes the winners of $feeders`,
  ({ round, index, feeders }) => {
    const battleSides = readBattleSides({ round, index }, WILD_CARD_AT_16)

    expect(battleSides.map(describeSide)).toStrictEqual(
      feeders.map(feeder => `winner of ${feeder}`),
    )
  },
)

test(`the left divisions meet in the first Final Roar battle`, () => {
  const topLeft = readNextBattle(
    { round: `ELITE_TRAIT`, index: 0 },
    WILD_CARD_AT_16,
  )
  const bottomLeft = readNextBattle(
    { round: `ELITE_TRAIT`, index: 1 },
    WILD_CARD_AT_16,
  )

  expect([topLeft, bottomLeft]).toStrictEqual([
    { round: `FINAL_ROAR`, index: 0 },
    { round: `FINAL_ROAR`, index: 0 },
  ])
})

test(`the Championship's winner moves on to no battle`, () => {
  const next = readNextBattle(
    { round: `CHAMPIONSHIP`, index: 0 },
    WILD_CARD_AT_16,
  )

  expect(next).toBeUndefined()
})

const describeSide = (side: ReturnType<typeof readBattleSides>[number]) =>
  side.kind === `seedSlot`
    ? `${side.seedSlot.position} ${side.seedSlot.seed}`
    : `winner of ${side.battle.round} ${side.battle.index}`
