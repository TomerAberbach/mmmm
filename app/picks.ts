import { listBattles, toBattleKey } from './bracket.ts'
import type { BattleRef, Winners } from './bracket.ts'
import { fillSides, findWinner } from './seeded-bracket.ts'
import type { Combatant, SeededBracket } from './seeded-bracket.ts'

export type Picks = Winners

export const TOTAL_BATTLES = listBattles().length

/** Every combatant who could win the battle, given the winners so far */
export const listContenders = (
  bracket: SeededBracket,
  battle: BattleRef,
  winners: Winners = {},
): Combatant[] =>
  fillSides(bracket, battle, winners).flatMap(side =>
    side.kind === `combatant`
      ? side.combatant
      : listContenders(bracket, side.battle, winners),
  )

export const isContender = (
  bracket: SeededBracket,
  battle: BattleRef,
  combatantId: string,
  winners: Winners = {},
): boolean =>
  listContenders(bracket, battle, winners).some(({ id }) => id === combatantId)

/**
 * Picks `winner`, a combatant ID, in the battle, and in every earlier battle
 * on its way there that isn't among the `known` winners. Clears each later
 * pick that no longer has its winner on one of its battle's sides. Throws when
 * the winner can't reach the battle
 */
export const pickWinner = (
  bracket: SeededBracket,
  picks: Picks,
  battle: BattleRef,
  winner: string,
  known: Winners = {},
): { picks: Picks; cleared: BattleRef[] } => {
  if (!isContender(bracket, battle, winner, known)) {
    throw new Error(`${winner} can't reach ${toBattleKey(battle)}`)
  }
  const picked = { ...picks }
  for (const won of listPathTo(bracket, battle, winner, known)) {
    picked[toBattleKey(won)] = winner
  }
  return keepReachablePicks(bracket, picked)
}

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
    keepReachablePicks(bracket, picks).cleared.length === 0
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

/**
 * The battle, then each earlier battle, not among `winners`, that the winner
 * wins on its way there
 */
const listPathTo = (
  bracket: SeededBracket,
  battle: BattleRef,
  winner: string,
  winners: Winners = {},
): BattleRef[] => {
  const side = fillSides(bracket, battle, winners).find(candidate =>
    candidate.kind === `combatant`
      ? candidate.combatant.id === winner
      : isContender(bracket, candidate.battle, winner, winners),
  )!
  return side.kind === `combatant`
    ? [battle]
    : [battle, ...listPathTo(bracket, side.battle, winner, winners)]
}

/**
 * Keeps, in play order, each pick whose winner is on one of its battle's sides
 * or is the merge of both, so a cleared pick also clears the picks that
 * depended on it
 */
export const keepReachablePicks = (
  bracket: SeededBracket,
  picks: Picks,
): { picks: Picks; cleared: BattleRef[] } => {
  const kept: Record<string, string> = {}
  const cleared: BattleRef[] = []
  for (const battle of listBattles()) {
    const key = toBattleKey(battle)
    const winner = picks[key]
    if (winner === undefined) {
      continue
    }
    if (findWinner(bracket, fillSides(bracket, battle, kept), winner)) {
      kept[key] = winner
    } else {
      cleared.push(battle)
    }
  }
  return { picks: kept, cleared }
}
