import { listBattles } from '../app/bracket.ts'
import { listContenders, pickWinner } from '../app/picks.ts'
import type { PickBracket, Picks } from '../app/picks.ts'

// Picks the first contender of every battle, in play order
export const pickEveryBattle = (bracket: PickBracket): Picks =>
  listBattles().reduce(
    (picks, battle) =>
      pickWinner(bracket, picks, battle, listContenders(bracket, battle)[0]!)
        .picks,
    {},
  )
