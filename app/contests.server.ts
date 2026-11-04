import { randomUUID } from 'node:crypto'
import { href } from 'react-router'
import { lockYears, readCurrentYear } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import { toAppUrl } from './env.server.ts'
import { createSecret } from './secrets.server.ts'

// `link` is the contest link, which players open
export type ContestSummary = { id: string; name: string; link: string }

export type Contest = ContestSummary & { yearId: number }

// Creates a contest in the current year. Returns the contest's ID, or null
// before any bracket is published
export const createContest = (
  educatorId: string,
  name: string,
): Promise<string | null> =>
  prisma.$transaction(async tx => {
    await lockYears(tx, `SHARE`)
    const yearId = await readCurrentYear(tx)
    if (yearId === null) {
      return null
    }
    const { id } = await tx.contest.create({
      data: {
        id: randomUUID(),
        yearId,
        educatorId,
        name,
        // 144 random bits keep the contest link short
        linkSecret: createSecret(18),
      },
      select: { id: true },
    })
    return id
  })

// Replaces the stored secret with the contest link built from it
const withLink = <Row extends { linkSecret: string }>({
  linkSecret,
  ...row
}: Row): Omit<Row, `linkSecret`> & { link: string } => ({
  ...row,
  link: toAppUrl(href(`/play/:linkSecret`, { linkSecret })).href,
})

// Oldest first
export const readEducatorContests = async (
  educatorId: string,
  yearId: number,
): Promise<ContestSummary[]> => {
  const contests = await prisma.contest.findMany({
    where: { educatorId, yearId },
    orderBy: [{ createdAt: `asc` }, { id: `asc` }],
    select: { id: true, name: true, linkSecret: true },
  })
  return contests.map(withLink)
}

// Null unless the educator runs the contest
export const readEducatorContest = async (
  educatorId: string,
  contestId: string,
): Promise<Contest | null> => {
  const contest = await prisma.contest.findFirst({
    where: { id: contestId, educatorId },
    select: { id: true, name: true, yearId: true, linkSecret: true },
  })
  return contest && withLink(contest)
}

// Returns whether the educator runs the contest
export const renameContest = async (
  educatorId: string,
  contestId: string,
  name: string,
): Promise<boolean> => {
  const { count } = await prisma.contest.updateMany({
    where: { id: contestId, educatorId },
    data: { name },
  })
  return count > 0
}

// What a contest link shows a player. Null for a link that matches no contest
export type ContestByLink = {
  id: string
  name: string
  yearId: number
  educatorName: string
}

export const readContestByLink = async (
  linkSecret: string,
): Promise<ContestByLink | null> => {
  const contest = await prisma.contest.findUnique({
    where: { linkSecret },
    select: {
      id: true,
      name: true,
      yearId: true,
      educator: { select: { name: true } },
    },
  })
  return (
    contest && {
      id: contest.id,
      name: contest.name,
      yearId: contest.yearId,
      educatorName: contest.educator.name,
    }
  )
}
