import { useEffect, useRef, useState } from 'react'
import { readStartingRound } from '~/bracket-view.ts'
import type { BracketView } from '~/bracket-view.ts'
import { toBattleKey } from '~/bracket.ts'
import type { BattleRef, Round } from '~/bracket.ts'

/**
 * The round the tabs show, and a way to show and focus any battle, switching
 * tabs when it's in another round
 */
export const useShownRound = (
  view: BracketView,
): {
  round: Round
  setRound: (round: Round) => void
  showBattle: (battle: BattleRef) => void
} => {
  const [round, setRound] = useState<Round>(() => readStartingRound(view))
  const battleToFocus = useRef<BattleRef>(undefined)
  useEffect(() => {
    if (battleToFocus.current) {
      focusBattle(battleToFocus.current)
      battleToFocus.current = undefined
    }
  }, [round])
  const showBattle = (battle: BattleRef): void => {
    if (battle.round === round) {
      focusBattle(battle)
    } else {
      // Focuses it once its round's tab renders
      battleToFocus.current = battle
      setRound(battle.round)
    }
  }
  return { round, setRound, showBattle }
}

/** Focuses the battle's first control in whichever layout is showing */
const focusBattle = (battle: BattleRef): void => {
  const boxes = document.querySelectorAll<HTMLElement>(
    `[data-battle="${CSS.escape(toBattleKey(battle))}"]`,
  )
  const box = [...boxes].find(element => element.checkVisibility())
  box?.scrollIntoView({ block: `center`, inline: `center` })
  box?.querySelector<HTMLElement>(`input, button`)?.focus()
}
