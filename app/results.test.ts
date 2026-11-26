import { expect, test } from 'vitest'
import { BRACKET_2026 } from '../prisma/brackets.ts'
import {
  findCombatantId,
  ROUND_1_FIRST,
  ROUND_2_FIRST,
  seedTestBracket,
} from '../test/picks.ts'
import { clearResult, listDecidableBattles, recordResult } from './results.ts'
import { listContenders } from './winners.ts'

const BRACKET = seedTestBracket(BRACKET_2026)
const NILE_CROCODILE = findCombatantId(BRACKET, `Nile Crocodile`)
const PAPYRUS = findCombatantId(BRACKET, `Papyrus`)

test(`a later round's result also records the winner's earlier wins`, () => {
  const { results } = recordResult(BRACKET, {}, ROUND_2_FIRST, NILE_CROCODILE)

  expect(results).toStrictEqual({
    'ROUND_1:0': NILE_CROCODILE,
    'ROUND_2:0': NILE_CROCODILE,
  })
})

test(`changing a result clears the later ones that depended on it`, () => {
  const { results: before } = recordResult(
    BRACKET,
    {},
    ROUND_2_FIRST,
    NILE_CROCODILE,
  )

  const change = recordResult(BRACKET, before, ROUND_1_FIRST, PAPYRUS)

  expect(change).toStrictEqual({
    results: { 'ROUND_1:0': PAPYRUS },
    cleared: [ROUND_2_FIRST],
  })
})

test(`clearing a result clears the later ones that depended on it`, () => {
  const { results: before } = recordResult(
    BRACKET,
    {},
    ROUND_2_FIRST,
    NILE_CROCODILE,
  )

  const change = clearResult(BRACKET, before, ROUND_1_FIRST)

  expect(change).toStrictEqual({ results: {}, cleared: [ROUND_2_FIRST] })
})

test(`a combatant who lost can't reach a later battle`, () => {
  const results = { 'ROUND_1:0': NILE_CROCODILE }

  const contenders = listContenders(BRACKET, ROUND_2_FIRST, results)

  expect(contenders.map(({ id }) => id)).not.toContain(PAPYRUS)
  expect(() => recordResult(BRACKET, results, ROUND_2_FIRST, PAPYRUS)).toThrow(
    `can't reach`,
  )
})

test(`a battle can be decided once every side is known`, () => {
  const none = listDecidableBattles(BRACKET, {})

  const { results } = recordResult(BRACKET, {}, ROUND_1_FIRST, NILE_CROCODILE)

  expect(none).toContainEqual(ROUND_1_FIRST)
  expect(none).not.toContainEqual(ROUND_2_FIRST)
  expect(listDecidableBattles(BRACKET, results)).not.toContainEqual(
    ROUND_1_FIRST,
  )
})
