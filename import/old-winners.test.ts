import { expect, test } from 'vitest'
import { bracketInputSchema } from '../app/bracket-input.ts'
import { createOldWinners } from './old-fixtures.ts'
import {
  parseOldWinners,
  readOldWinners,
  toBracketInput,
} from './old-winners.ts'

const NAMES: [string, string, string, string] = [`A`, `B`, `C`, `D`]

test(`a heap becomes a whole bracket with seeds stripped from its names`, () => {
  const input = toBracketInput(NAMES, createOldWinners({ decided: false }))!

  expect(bracketInputSchema.safeParse(input).success).toBe(true)
  expect(input.divisions.TOP_LEFT).toMatchObject({ name: `A` })
  expect(input.divisions.TOP_LEFT.combatants.slice(0, 3)).toStrictEqual([
    `TL 1`,
    `TL 2`,
    `TL 3`,
  ])
  expect(input.divisions.BOTTOM_LEFT.name).toBe(`B`)
  expect(input.divisions.TOP_RIGHT.name).toBe(`C`)
  expect(input.wildCard).toStrictEqual({
    position: `BOTTOM_LEFT`,
    seed: 16,
    entrants: [`Left`, `Right`],
  })
})

test(`a bracket missing a combatant isn't whole`, () => {
  const winners = createOldWinners({ decided: false })
  winners[70] = null

  expect(toBracketInput(NAMES, winners)).toBeNull()
})

test(`every decided node becomes its battle's winner`, () => {
  const { winners, unknown } = readOldWinners(
    createOldWinners({ decided: true }),
  )

  expect(unknown).toBe(0)
  expect(Object.keys(winners)).toHaveLength(64)
  expect(winners[`WILD_CARD:0`]).toStrictEqual({
    kind: `entrant`,
    index: 0,
  })
  expect(winners[`ROUND_1:31`]).toStrictEqual({
    kind: `seedSlot`,
    seedSlot: { position: `BOTTOM_RIGHT`, seed: 2 },
  })
  expect(winners[`ELITE_TRAIT:1`]).toStrictEqual({
    kind: `seedSlot`,
    seedSlot: { position: `BOTTOM_LEFT`, seed: 1 },
  })
  expect(winners[`CHAMPIONSHIP:0`]).toStrictEqual({
    kind: `seedSlot`,
    seedSlot: { position: `TOP_LEFT`, seed: 1 },
  })
})

test(`a winner on neither side is left undecided, as are the battles after it`, () => {
  const winners = createOldWinners({ decided: true })
  winners[31] = `Unknown (1)`

  const read = readOldWinners(winners)

  expect(read.winners[`ROUND_1:0`]).toBeUndefined()
  expect(read.winners[`ROUND_2:0`]).toBeUndefined()
  expect(read.winners[`ROUND_2:1`]).toBeDefined()
  expect(read.unknown).toBeGreaterThan(0)
})

test.each([
  [`text that isn't JSON`, `nope`],
  [`too few nodes`, `[]`],
  [`no wild card`, JSON.stringify(Array.from({ length: 127 }, () => null))],
])(`%s isn't a heap`, (_, json) => {
  expect(parseOldWinners(json)).toBeNull()
})
