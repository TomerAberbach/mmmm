import { isDecided } from './bracket-view.ts'
import type { MarkedBracketView } from './bracket-view.ts'
import { ROUNDS } from './bracket.ts'
import type { Round } from './bracket.ts'
import { ROUND_POINTS } from './scoring.ts'

export type RoundScore = {
  round: Round
  right: number
  decided: number
  earned: number
  /** The points that undecided picks could still earn */
  possible: number
}

export type Scorecard = {
  score: number
  possible: number
  isFinal: boolean
  rounds: RoundScore[]
}

/** The score is final once the champion is saved */
export const readScorecard = ({ battles }: MarkedBracketView): Scorecard => {
  const rounds = ROUNDS.map((round): RoundScore => {
    const countMarks = (counted: `RIGHT` | `UNDECIDED`): number =>
      battles[round].filter(({ marking }) => marking.mark === counted).length
    const right = countMarks(`RIGHT`)
    return {
      round,
      right,
      decided: battles[round].filter(isDecided).length,
      earned: right * ROUND_POINTS[round],
      possible: countMarks(`UNDECIDED`) * ROUND_POINTS[round],
    }
  })
  return {
    score: rounds.reduce((score, { earned }) => score + earned, 0),
    possible: rounds.reduce((total, { possible }) => total + possible, 0),
    isFinal: battles.CHAMPIONSHIP.every(isDecided),
    rounds,
  }
}
