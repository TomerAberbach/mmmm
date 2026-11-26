import { listBattles, toBattleKey } from './bracket.ts'
import type { Winners } from './bracket.ts'
import type { SeededBracket } from './seeded-bracket.ts'
import { keepReachableWinners, TOTAL_BATTLES } from './winners.ts'

export type Picks = Winners

/**
 * Whether every pick is of a battle in the bracket, with a winner on one of its
 * sides or a merge of both
 */
export const arePicksConsistent = (
  bracket: SeededBracket,
  picks: Picks,
): boolean => {
  const battleKeys = new Set(listBattles().map(toBattleKey))
  return (
    Object.keys(picks).every(key => battleKeys.has(key)) &&
    keepReachableWinners(bracket, picks).cleared.length === 0
  )
}

/**
 * Whether the picks are consistent and pick every battle, as a submission must
 */
export const arePicksComplete = (
  bracket: SeededBracket,
  picks: Picks,
): boolean =>
  Object.keys(picks).length === TOTAL_BATTLES &&
  arePicksConsistent(bracket, picks)

export const arePicksEqual = (picks: Picks, otherPicks: Picks): boolean =>
  Object.keys(picks).length === Object.keys(otherPicks).length &&
  Object.entries(picks).every(([key, winner]) => otherPicks[key] === winner)
