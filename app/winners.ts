import { listBattles, toBattleKey } from './bracket.ts'
import type { BattleRef, Winners } from './bracket.ts'
import { fillSides, findWinner } from './seeded-bracket.ts'
import type { Combatant, SeededBracket } from './seeded-bracket.ts'

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
 * Makes `winner`, a combatant ID, win the battle and every earlier battle on its
 * way there that isn't among the `known` winners. Clears each later battle whose
 * winner is no longer on one of its sides. Throws when the winner can't reach
 * the battle
 */
export const setWinner = (
  bracket: SeededBracket,
  winners: Winners,
  battle: BattleRef,
  winner: string,
  known: Winners = {},
): { winners: Winners; cleared: BattleRef[] } => {
  if (!isContender(bracket, battle, winner, known)) {
    throw new Error(`${winner} can't reach ${toBattleKey(battle)}`)
  }
  const changed = { ...winners }
  for (const won of listPathTo(bracket, battle, winner, known)) {
    changed[toBattleKey(won)] = winner
  }
  return keepReachableWinners(bracket, changed)
}

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
 * Keeps, in play order, each winner on one of its battle's sides or the merge of
 * both, so a cleared winner also clears the later ones that depended on it
 */
export const keepReachableWinners = (
  bracket: SeededBracket,
  winners: Winners,
): { winners: Winners; cleared: BattleRef[] } => {
  const kept: Record<string, string> = {}
  const cleared: BattleRef[] = []
  for (const battle of listBattles()) {
    const key = toBattleKey(battle)
    const winner = winners[key]
    if (winner === undefined) {
      continue
    }
    if (findWinner(bracket, fillSides(bracket, battle, kept), winner)) {
      kept[key] = winner
    } else {
      cleared.push(battle)
    }
  }
  return { winners: kept, cleared }
}
