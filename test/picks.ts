import { mapCombatants } from '../app/bracket-input.ts'
import type { BracketInput } from '../app/bracket-input.ts'
import type { BattleRef } from '../app/bracket.ts'
import { toSeededBracket } from '../app/seeded-bracket.ts'
import type { SeededBracket, StoredBracket } from '../app/seeded-bracket.ts'

export const ROUND_1_FIRST: BattleRef = { round: `ROUND_1`, index: 0 }
export const ROUND_2_FIRST: BattleRef = { round: `ROUND_2`, index: 0 }
export const CHAMPIONSHIP: BattleRef = { round: `CHAMPIONSHIP`, index: 0 }

/** The input with a made-up row ID for each combatant */
export const storeTestBracket = (input: BracketInput): StoredBracket => ({
  ...mapCombatants(input, name => ({ id: `id-${name}`, name })),
  merges: [],
})

export const seedTestBracket = (input: BracketInput): SeededBracket =>
  toSeededBracket(storeTestBracket(input))

/** Throws when the bracket has no combatant named `name` */
export const findCombatantId = (
  bracket: SeededBracket,
  name: string,
): string => {
  const combatant = bracket.combatantById
    .values()
    .find(candidate => candidate.name === name)
  if (!combatant) {
    throw new Error(`${name} isn't in the bracket`)
  }
  return combatant.id
}
