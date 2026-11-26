import type { BracketInput } from '../app/bracket-input.ts'
import { saveUnpublishedBracket } from '../app/brackets.server.ts'
import { prisma } from '../app/db.server.ts'
import { BRACKET_2026 } from '../prisma/brackets.ts'

/** Returns a year newer than any other year stored in the test database */
export const claimYear = async (): Promise<number> => {
  const [row] = await prisma.$queryRaw<{ year: number }[]>`
    SELECT nextval('test_year')::int AS year
  `
  return row!.year
}

/**
 * Stores 2026's bracket, or `input`, under a year from `claimYear`, and
 * returns the year. A published one is the current year until a test adds a
 * newer one
 */
export const addYear = async ({
  published,
  input = BRACKET_2026,
}: {
  published: boolean
  input?: BracketInput
}): Promise<number> => {
  const year = await claimYear()
  await saveUnpublishedBracket(year, input)
  if (published) {
    // Skips the champion that publishing over a current year requires
    await prisma.bracket.update({
      where: { year },
      data: { publishedAt: new Date() },
    })
  }
  return year
}
