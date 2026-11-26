import { prisma } from './db.server.ts'
import type { Prisma } from './generated/prisma/client.ts'
import {
  ORGANIZATION_SELECT,
  toContestOrganization,
} from './organizations.server.ts'
import { describeOrganization } from './organizations.ts'
import type { Organization } from './organizations.ts'
import { CONTEST_OUTSIDE_TRASH } from './outside-trash.server.ts'
import { countRowsBefore, PAGE_SIZE, toPageNumber } from './page-number.ts'
import type { PageNumber } from './page-number.ts'

export type AdminContest = {
  id: string
  name: string
  /** Null for an orphaned contest */
  educatorName: string | null
  organizationName: string | null
  year: number
  approvedCount: number
  /** Whether the organization and global leaderboards leave it out */
  isHidden: boolean
  isInTrash: boolean
}

/**
 * Hidden contests first, then the newest year's, by name. Those in the trash
 * come last, most recently deleted first
 */
export const readAdminContests = async (
  page: number,
): Promise<{ contests: AdminContest[]; page: PageNumber }> => {
  const pageNumber = toPageNumber(page, await prisma.contest.count())
  const contests = await prisma.contest.findMany({
    orderBy: [
      { deletedAt: { sort: `desc`, nulls: `first` } },
      { isHidden: `desc` },
      { year: `desc` },
      { name: `asc` },
      { id: `asc` },
    ],
    skip: countRowsBefore(pageNumber),
    take: PAGE_SIZE,
    select: ADMIN_CONTEST_SELECT,
  })
  return {
    contests: contests.map(toAdminContest),
    page: pageNumber,
  }
}

const ADMIN_CONTEST_SELECT = {
  id: true,
  name: true,
  year: true,
  isHidden: true,
  deletedAt: true,
  orphanedFrom: { select: ORGANIZATION_SELECT },
  educator: {
    select: {
      name: true,
      organization: { select: ORGANIZATION_SELECT },
    },
  },
  _count: {
    select: {
      players: {
        where: { deletedAt: null, submission: { status: `APPROVED` } },
      },
    },
  },
} satisfies Prisma.ContestSelect

const toAdminContest = ({
  educator,
  orphanedFrom,
  deletedAt,
  _count,
  ...contest
}: Prisma.ContestGetPayload<{
  select: typeof ADMIN_CONTEST_SELECT
}>): AdminContest => ({
  ...contest,
  educatorName: educator?.name ?? null,
  organizationName: describe(toContestOrganization({ educator, orphanedFrom })),
  approvedCount: _count.players,
  isInTrash: deletedAt !== null,
})

const describe = (organization: Organization | null): string | null =>
  organization && describeOrganization(organization)

export type AdminPlayer = {
  id: string
  displayName: string
  /** Whether the player or the contest is in the trash */
  isInTrash: boolean
}

/**
 * A contest and its players by name, even when they or the contest are in the
 * trash. Null when it's gone
 */
export const readAdminContest = async (
  contestId: string,
): Promise<{ contest: AdminContest; players: AdminPlayer[] } | null> => {
  const row = await prisma.contest.findUnique({
    where: { id: contestId },
    select: {
      ...ADMIN_CONTEST_SELECT,
      players: {
        orderBy: [{ displayName: `asc` }, { id: `asc` }],
        select: { id: true, displayName: true, deletedAt: true },
      },
    },
  })
  if (!row) {
    return null
  }
  const { players, ...rest } = row
  const contest = toAdminContest(rest)
  return {
    contest,
    players: players.map(({ deletedAt, ...player }) => ({
      ...player,
      isInTrash: deletedAt !== null || contest.isInTrash,
    })),
  }
}

/** Returns whether the contest is outside the trash */
export const setContestHidden = async (
  contestId: string,
  isHidden: boolean,
): Promise<boolean> => {
  const { count } = await prisma.contest.updateMany({
    where: { id: contestId, ...CONTEST_OUTSIDE_TRASH },
    data: { isHidden },
  })
  return count > 0
}
