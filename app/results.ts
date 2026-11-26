import { isSameName } from './bracket-input.ts'
import { listBattles, toBattleKey } from './bracket.ts'
import type { BattleRef, Winners } from './bracket.ts'
import { keepReachablePicks, pickWinner } from './picks.ts'
import { fillSides, listCombatants } from './seeded-bracket.ts'
import type { SeededBracket } from './seeded-bracket.ts'

/** Who won each battle with a result, keyed by `toBattleKey` */
export type Results = Winners

/** The results after a change, with the battles whose results it clears */
export type ResultsChange = { results: Results; cleared: BattleRef[] }

/**
 * Records the combatant as the battle's winner, and as the winner of the
 * earlier battles on their way there. Clears each later result that depended on
 * the battle's earlier one. Throws when the combatant can't win the battle
 */
export const recordResult = (
  bracket: SeededBracket,
  results: Results,
  battle: BattleRef,
  winnerId: string,
): ResultsChange => {
  const { picks, cleared } = pickWinner(
    bracket,
    results,
    battle,
    winnerId,
    results,
  )
  return { results: picks, cleared }
}

/** Records the merge of the battle's sides, which must be its members */
export const recordMerge = (
  results: Results,
  battle: BattleRef,
  mergeId: string,
): ResultsChange => ({
  results: { ...results, [toBattleKey(battle)]: mergeId },
  cleared: [],
})

/**
 * The IDs of the two combatants that a merge of the battle would join, or null
 * for a battle that has a result or too few known sides
 */
export const readMergeMembers = (
  bracket: SeededBracket,
  results: Results,
  battle: BattleRef,
): string[] | null => {
  if (results[toBattleKey(battle)] !== undefined) {
    return null
  }
  const memberIds = fillSides(bracket, battle, results).flatMap(side =>
    side.kind === `combatant` ? side.combatant.id : [],
  )
  return memberIds.length === 2 ? memberIds : null
}

/** Whether no combatant in the bracket has the name */
export const isNameFree = (bracket: SeededBracket, name: string): boolean =>
  listCombatants(bracket).every(other => !isSameName(other.name, name))

/** Clears the battle's result, and each later one that depended on it */
export const clearResult = (
  bracket: SeededBracket,
  results: Results,
  battle: BattleRef,
): ResultsChange => {
  const { [toBattleKey(battle)]: _, ...rest } = results
  const { picks, cleared } = keepReachablePicks(bracket, rest)
  return { results: picks, cleared }
}

/** The battles with every side known and no result, in play order */
export const listDecidableBattles = (
  bracket: SeededBracket,
  results: Results,
): BattleRef[] =>
  listBattles().filter(
    battle =>
      results[toBattleKey(battle)] === undefined &&
      fillSides(bracket, battle, results).every(
        side => side.kind === `combatant`,
      ),
  )
