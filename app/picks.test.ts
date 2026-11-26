import { expect, test } from 'vitest'
import { BRACKET_2025 } from '../prisma/brackets.ts'
import { CHAMPIONSHIP, ROUND_1_FIRST, seedTestBracket } from '../test/picks.ts'
import { arePicksConsistent } from './picks.ts'
import { listContenders, setWinner } from './winners.ts'

const BRACKET = seedTestBracket(BRACKET_2025)

const SEED_1 = listContenders(BRACKET, ROUND_1_FIRST)[0]!.id

test.each([
  {
    scenario: `picks made by picking winners`,
    picks: setWinner(BRACKET, {}, CHAMPIONSHIP, SEED_1).winners,
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
  {
    scenario: `a winner who isn't a combatant in the bracket`,
    picks: { 'ROUND_1:0': `another-bracket-combatant` },
    consistent: false,
  },
])(`$scenario are consistent: $consistent`, ({ picks, consistent }) => {
  expect(arePicksConsistent(BRACKET, picks)).toBe(consistent)
})
