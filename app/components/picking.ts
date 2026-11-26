import { createContext, useContext } from 'react'
import type { BattleRef } from '~/bracket.ts'
import type { Combatant } from '~/seeded-bracket.ts'

/**
 * Turns the bracket's battle boxes into controls for picking each winner, or
 * for recording results, where pressing a recorded winner calls `pick` too
 */
export type Picking = {
  kind: `picks` | `results`
  pick: (battle: BattleRef, winnerId: string) => void
  listContenders: (battle: BattleRef) => Combatant[]
  isCleared: (battle: BattleRef) => boolean
}

export const PickingContext = createContext<Picking | null>(null)

/** Null outside a bracket being picked */
export const usePicking = (): Picking | null => useContext(PickingContext)
