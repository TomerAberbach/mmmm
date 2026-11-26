import { data } from 'react-router'
import { readCurrentYear } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import type { Prisma } from './generated/prisma/client.ts'
import { CONTEST_OUTSIDE_TRASH } from './outside-trash.server.ts'
import { sharedWith } from './shares.server.ts'

/** A past year, and the current year its banner links back to */
export type PastYear = { year: number; currentYear: number }

/** Null for the current year and any without a published bracket before it */
export const readPastYear = async (year: number): Promise<PastYear | null> => {
  const current = await readCurrentYear()
  return current && year < current.year
    ? { year, currentYear: current.year }
    : null
}

/** Throws the not-found page for an address's year without a published bracket */
export const readRequiredYear = async (param: string): Promise<number> => {
  // Only digits, since `Number` also reads other spellings, such as `0x7EA`
  const bracket = /^[1-9]\d{0,3}$/v.test(param)
    ? await prisma.bracket.findUnique({
        where: { year: Number(param), publishedAt: { not: null } },
        select: { year: true },
      })
    : null
  if (!bracket) {
    // React Router renders a thrown response with the error page
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw data(null, { status: 404 })
  }
  return bracket.year
}

/** `champion` is null for a year imported without one */
export type PastYearSummary = {
  year: number
  champion: string | null
  contests: {
    id: string
    name: string
    /** Null for the educator's own */
    sharedBy: string | null
    submissionCount: number
  }[]
}

/**
 * Every past year with the contests the educator runs or that are
 * shared with them, newest first
 */
export const readPastYears = async (
  educatorId: string,
): Promise<PastYearSummary[]> => {
  const current = await readCurrentYear()
  if (!current) {
    return []
  }
  const brackets = await prisma.bracket.findMany({
    where: pastYears(current.year),
    orderBy: { year: `desc` },
    select: {
      year: true,
      battles: {
        where: { round: `CHAMPIONSHIP` },
        select: { result: { select: { winner: { select: { name: true } } } } },
      },
      contests: {
        where: {
          OR: [
            { educatorId, ...CONTEST_OUTSIDE_TRASH },
            sharedWith(educatorId),
          ],
        },
        orderBy: [{ createdAt: `asc` }, { id: `asc` }],
        select: {
          id: true,
          name: true,
          educator: { select: { id: true, name: true } },
          _count: {
            select: {
              players: {
                where: { deletedAt: null, submission: { isNot: null } },
              },
            },
          },
        },
      },
    },
  })
  return brackets.map(({ year, battles, contests }) => ({
    year,
    champion: battles[0]?.result?.winner.name ?? null,
    contests: contests.map(({ educator, _count, ...contest }) => ({
      ...contest,
      sharedBy: educator && educator.id !== educatorId ? educator.name : null,
      submissionCount: _count.players,
    })),
  }))
}

export const hasPastYears = async (currentYear: number): Promise<boolean> =>
  (await prisma.bracket.count({ where: pastYears(currentYear) })) > 0

const pastYears = (currentYear: number): Prisma.BracketWhereInput => ({
  year: { lt: currentYear },
  publishedAt: { not: null },
})
