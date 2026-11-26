import { listBattles } from '../app/bracket.ts'
import type { Picks } from '../app/picks.ts'
import type { SeededBracket } from '../app/seeded-bracket.ts'
import { listContenders, setWinner } from '../app/winners.ts'

/**
 * Picks every battle in play order: the contender at the index, which can count
 * from the end
 */
export const pickEveryBattle = (bracket: SeededBracket, at = 0): Picks =>
  listBattles().reduce<Picks>(
    (picks, battle) =>
      setWinner(
        bracket,
        picks,
        battle,
        listContenders(bracket, battle, picks).at(at)!.id,
      ).winners,
    {},
  )
