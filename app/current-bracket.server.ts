import { buildBracketView } from './bracket-view.ts'
import type { BracketView } from './bracket-view.ts'
import { hidePastDate, readCurrentBracket } from './brackets.server.ts'
import { formatDate } from './dates.ts'
import { prisma } from './db.server.ts'
import { toSeededBracket } from './seeded-bracket.ts'

export type CurrentBracket = {
  view: BracketView
  /** Such as "March 19, 2027", until the year locks */
  expectedLockDate: string | null
}

/** Null before any bracket is published */
export const readCurrentBracketView =
  async (): Promise<CurrentBracket | null> => {
    const current = await readCurrentBracket()
    return (
      current && {
        view: buildBracketView(
          current.year,
          toSeededBracket(current.bracket),
          current.results,
        ),
        expectedLockDate:
          current.expectedLockDate && formatDate(current.expectedLockDate),
      }
    )
  }

/** Such as "March 19, 2027". Null once it passes or the year locks */
export const readExpectedLockDate = async (
  year: number,
): Promise<string | null> => {
  const bracket = await prisma.bracket.findUnique({
    where: { year, lockedAt: null },
    select: { expectedLockDate: true },
  })
  const date = hidePastDate(bracket?.expectedLockDate ?? null)
  return date && formatDate(date)
}
