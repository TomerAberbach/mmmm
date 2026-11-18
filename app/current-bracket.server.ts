import { buildBracketView } from './bracket-view.ts'
import type { BracketView } from './bracket-view.ts'
import { readCurrentBracket } from './brackets.server.ts'
import { formatDate } from './dates.ts'
import { toSeededBracket } from './seeded-bracket.ts'

export type CurrentBracket = {
  view: BracketView
  // Such as "March 19, 2027"
  expectedLockDate: string | null
}

// Null before any bracket is published
export const readCurrentBracketView =
  async (): Promise<CurrentBracket | null> => {
    const current = await readCurrentBracket()
    return (
      current && {
        view: buildBracketView(
          current.year,
          toSeededBracket(current.bracket),
          {},
        ),
        expectedLockDate:
          current.expectedLockDate && formatDate(current.expectedLockDate),
      }
    )
  }
