import { listBattles } from '../app/bracket.ts'
import { listContenders, pickWinner } from '../app/picks.ts'
import type { Picks } from '../app/picks.ts'
import type { SeededBracket } from '../app/seeded-bracket.ts'

// Picks the first contender of every battle, in play order
export const pickEveryBattle = (bracket: SeededBracket): Picks =>
  listBattles().reduce(
    (picks, battle) =>
      pickWinner(bracket, picks, battle, listContenders(bracket, battle)[0]!)
        .picks,
    {},
  )
