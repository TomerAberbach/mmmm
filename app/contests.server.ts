import { randomBytes, randomUUID } from 'node:crypto'
import { lockBracketRow } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import { toAppUrl } from './env.server.ts'

// `link` is the contest link, which players open
export type ContestSummary = { id: string; name: string; link: string }

export type Contest = ContestSummary & { yearId: number }

// Creates a contest in the year, unless its bracket isn't published. Returns
// the contest's ID, or null when it created none
export const createContest = (
  educatorId: string,
  yearId: number,
  name: string,
): Promise<string | null> =>
  prisma.$transaction(async tx => {
    if (!(await lockBracketRow(tx, yearId))?.isPublished) {
      return null
    }
    const { id } = await tx.contest.create({
      data: {
        id: randomUUID(),
        yearId,
        educatorId,
        name,
        linkSecret: createLinkSecret(),
      },
      select: { id: true },
    })
    return id
  })

// 144 random bits, written in 24 URL-safe characters
const createLinkSecret = (): string => randomBytes(18).toString(`base64url`)

// Replaces the stored secret with the contest link built from it
const withLink = <Row extends { linkSecret: string }>({
  linkSecret,
  ...row
}: Row): Omit<Row, `linkSecret`> & { link: string } => ({
  ...row,
  link: toAppUrl(`/play/${linkSecret}`).href,
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
export const readContestByLink = async (
  linkSecret: string,
): Promise<{ name: string; yearId: number; educatorName: string } | null> => {
  const contest = await prisma.contest.findUnique({
    where: { linkSecret },
    select: { name: true, yearId: true, educator: { select: { name: true } } },
  })
  return (
    contest && {
      name: contest.name,
      yearId: contest.yearId,
      educatorName: contest.educator.name,
    }
  )
}
