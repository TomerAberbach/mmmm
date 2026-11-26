import { prisma } from './db.server.ts'
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
}

/** Hidden contests first, then the newest year's, by name */
export const readAdminContests = async (
  page: number,
): Promise<{ contests: AdminContest[]; page: PageNumber }> => {
  const where = CONTEST_OUTSIDE_TRASH
  const pageNumber = toPageNumber(page, await prisma.contest.count({ where }))
  const contests = await prisma.contest.findMany({
    where,
    orderBy: [
      { isHidden: `desc` },
      { year: `desc` },
      { name: `asc` },
      { id: `asc` },
    ],
    skip: countRowsBefore(pageNumber),
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      year: true,
      isHidden: true,
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
    },
  })
  return {
    contests: contests.map(
      ({ educator, orphanedFrom, _count, ...contest }) => ({
        ...contest,
        educatorName: educator?.name ?? null,
        organizationName: describe(
          toContestOrganization({ educator, orphanedFrom }),
        ),
        approvedCount: _count.players,
      }),
    ),
    page: pageNumber,
  }
}

const describe = (organization: Organization | null): string | null =>
  organization && describeOrganization(organization)

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
