import { buildBracketView } from './bracket-view.ts'
import type { BracketView } from './bracket-view.ts'
import { readCurrentBracket } from './brackets.server.ts'
import { formatDate } from './dates.ts'

export type CurrentBracket = {
  view: BracketView
  // Such as "March 19, 2027"
  expectedLockDate: string | null
}

// Null before any bracket is published
export const readCurrentBracketView =
  async (): Promise<CurrentBracket | null> => {
    const bracket = await readCurrentBracket()
    return (
      bracket && {
        view: buildBracketView(bracket.year, bracket.input, []),
        expectedLockDate:
          bracket.expectedLockDate && formatDate(bracket.expectedLockDate),
      }
    )
  }
