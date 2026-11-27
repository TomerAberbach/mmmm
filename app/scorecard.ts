import { isDecided } from './bracket-view.ts'
import type { MarkedBracketView } from './bracket-view.ts'
import { ROUNDS } from './bracket.ts'
import type { Round } from './bracket.ts'
import { ROUND_POINTS } from './scoring.ts'

export type RoundScore = {
  round: Round
  right: number
  decided: number
  /** The battles that can still be decided */
  left: number
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

/**
 * The score is final once every battle is decided, or once the year is past,
 * when an undecided pick can't earn anything
 */
export const readScorecard = (
  { battles }: MarkedBracketView,
  isPast: boolean,
): Scorecard => {
  const rounds = ROUNDS.map((round): RoundScore => {
    const countMarks = (counted: `RIGHT` | `UNDECIDED`): number =>
      battles[round].filter(({ marking }) => marking.mark === counted).length
    const right = countMarks(`RIGHT`)
    const decided = battles[round].filter(isDecided).length
    return {
      round,
      right,
      decided,
      left: isPast ? 0 : battles[round].length - decided,
      earned: right * ROUND_POINTS[round],
      possible: isPast ? 0 : countMarks(`UNDECIDED`) * ROUND_POINTS[round],
    }
  })
  return {
    score: rounds.reduce((score, { earned }) => score + earned, 0),
    possible: rounds.reduce((total, { possible }) => total + possible, 0),
    isFinal: rounds.every(({ left }) => left === 0),
    rounds,
  }
}
