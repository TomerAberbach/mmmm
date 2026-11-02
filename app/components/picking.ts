import { createContext, useContext } from 'react'
import type { BattleRef } from '~/bracket.ts'

// Turns the bracket's battle boxes into controls for picking each winner
export type Picking = {
  pick: (battle: BattleRef, winner: string) => void
  listContenders: (battle: BattleRef) => string[]
  isCleared: (battle: BattleRef) => boolean
}

export const PickingContext = createContext<Picking | null>(null)

// Null outside a bracket being picked
export const usePicking = (): Picking | null => useContext(PickingContext)
