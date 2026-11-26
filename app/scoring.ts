import { BATTLE_COUNTS, ROUNDS, toBattleKey } from './bracket.ts'
import type { BattleRef, Round } from './bracket.ts'
import type { Results } from './results.ts'
import { listOriginalIds } from './seeded-bracket.ts'
import type { SeededBracket } from './seeded-bracket.ts'
import { listContenders } from './winners.ts'

/** The points for a right pick of one of the round's battles */
export const ROUND_POINTS: Record<Round, number> = {
  WILD_CARD: 1,
  ROUND_1: 1,
  ROUND_2: 2,
  SWEET_16: 3,
  ELITE_TRAIT: 5,
  FINAL_ROAR: 8,
  CHAMPIONSHIP: 13,
}

/** The score of a bracket with every pick right */
export const PERFECT_SCORE = ROUNDS.reduce(
  (score, round) => score + ROUND_POINTS[round] * BATTLE_COUNTS[round],
  0,
)

/**
 * The combatants, by ID, whose picks to win the battle score. A merge's winner
 * stands for each member
 */
export const listRightWinners = (
  bracket: SeededBracket,
  results: Results,
  battle: BattleRef,
): string[] => {
  const winner = results[toBattleKey(battle)]
  return winner === undefined ? [] : listOriginalIds(bracket, winner)
}

/**
 * How a pick stands. A pick whose winner can no longer win the battle is wrong
 * before the battle is decided
 */
export type PickMark = `RIGHT` | `WRONG` | `UNDECIDED`

/** Marks a pick of `winner`, a combatant ID, to win the battle */
export const markPick = (
  bracket: SeededBracket,
  results: Results,
  battle: BattleRef,
  winner: string,
): PickMark => {
  const rightWinners = listRightWinners(bracket, results, battle)
  if (rightWinners.includes(winner)) {
    return `RIGHT`
  }
  return rightWinners.length === 0 &&
    listContenders(bracket, battle, results).some(({ id }) =>
      listOriginalIds(bracket, id).includes(winner),
    )
    ? `UNDECIDED`
    : `WRONG`
}
