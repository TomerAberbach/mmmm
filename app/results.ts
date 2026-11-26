import { listBattles, toBattleKey } from './bracket.ts'
import type { BattleRef, Winners } from './bracket.ts'
import { isContender, keepReachablePicks, pickWinner } from './picks.ts'
import { fillSides } from './seeded-bracket.ts'
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
  if (!isContender(bracket, battle, winnerId, results)) {
    throw new Error(`${winnerId} can't win ${toBattleKey(battle)}`)
  }
  const { picks, cleared } = pickWinner(bracket, results, battle, winnerId)
  return { results: picks, cleared }
}

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
