import { randomUUID } from 'node:crypto'
import { href } from 'react-router'
import { withCurrentYear } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import { changeContests } from './editable-contests.server.ts'
import { toAppUrl } from './env.server.ts'
import { CONTEST_OUTSIDE_TRASH } from './outside-trash.server.ts'
import { createSecret } from './secrets.server.ts'

/** `link` is the contest link, which players open */
export type ContestSummary = { id: string; name: string; link: string }

export type Contest = ContestSummary & { year: number }

/**
 * Creates a contest in the current year, and returns its ID. Refuses before any
 * bracket is published, and once the year locks
 */
export const createContest = (
  educatorId: string,
  name: string,
): Promise<{ id: string } | { refusal: `NOT_PUBLISHED` | `LOCKED` }> =>
  withCurrentYear(async (tx, current) => {
    if (!current) {
      return { refusal: `NOT_PUBLISHED` }
    }
    if (current.isLocked) {
      return { refusal: `LOCKED` }
    }
    return tx.contest.create({
      data: {
        id: randomUUID(),
        year: current.year,
        educatorId,
        name,
        linkSecret: createContestSecret(),
      },
      select: { id: true },
    })
  })

/** Replaces the stored secret with the contest link built from it */
const withLink = <Row extends { linkSecret: string }>({
  linkSecret,
  ...row
}: Row): Omit<Row, `linkSecret`> & { link: string } => ({
  ...row,
  link: toAppUrl(href(`/play/:linkSecret`, { linkSecret })).href,
})

/** Oldest first */
export const readEducatorContests = async (
  educatorId: string,
  year: number,
): Promise<ContestSummary[]> => {
  const contests = await prisma.contest.findMany({
    where: { educatorId, year, ...CONTEST_OUTSIDE_TRASH },
    orderBy: [{ createdAt: `asc` }, { id: `asc` }],
    select: { id: true, name: true, linkSecret: true },
  })
  return contests.map(withLink)
}

/** Null unless the educator runs the contest */
export const readEducatorContest = async (
  educatorId: string,
  contestId: string,
): Promise<Contest | null> => {
  const contest = await prisma.contest.findFirst({
    where: { id: contestId, educatorId, ...CONTEST_OUTSIDE_TRASH },
    select: { id: true, name: true, year: true, linkSecret: true },
  })
  return contest && withLink(contest)
}

/** Returns whether the educator runs the contest */
export const renameContest = (
  educatorId: string,
  contestId: string,
  name: string,
): Promise<boolean> =>
  changeContests(educatorId, async (tx, contests) => {
    const { count } = await tx.contest.updateMany({
      where: { id: contestId, ...contests, ...CONTEST_OUTSIDE_TRASH },
      data: { name },
    })
    return count > 0
  })

/** A contest as its players see it, without its contest link */
export type PlayContest = {
  id: string
  name: string
  year: number
  /** Null for an orphaned contest, which takes no new players */
  educatorName: string | null
}

type FoundPlayContest = { contest: PlayContest; isDeleted: boolean }

/** Null for a link that matches no contest */
export const readContestByLink = (
  linkSecret: string,
): Promise<FoundPlayContest | null> => readPlayedContest({ linkSecret })

export const readContestById = (id: string): Promise<FoundPlayContest | null> =>
  readPlayedContest({ id })

const readPlayedContest = async (
  where: { linkSecret: string } | { id: string },
): Promise<FoundPlayContest | null> => {
  const contest = await prisma.contest.findUnique({
    where,
    select: {
      id: true,
      name: true,
      year: true,
      deletedAt: true,
      educator: { select: { name: true } },
    },
  })
  return (
    contest && {
      contest: {
        id: contest.id,
        name: contest.name,
        year: contest.year,
        educatorName: contest.educator?.name ?? null,
      },
      isDeleted: contest.deletedAt !== null,
    }
  )
}

/**
 * Replaces the contest link, so the old one stops working. Players keep their
 * personal links. Returns whether the educator runs the contest
 */
export const replaceContestLink = (
  educatorId: string,
  contestId: string,
): Promise<boolean> =>
  changeContests(educatorId, async (tx, contests) => {
    const { count } = await tx.contest.updateMany({
      where: { id: contestId, ...contests, ...CONTEST_OUTSIDE_TRASH },
      data: {
        linkSecret: createContestSecret(),
        linkVersion: { increment: 1 },
      },
    })
    return count > 0
  })

/** 144 random bits keep the contest link short */
const createContestSecret = (): string => createSecret(18)
