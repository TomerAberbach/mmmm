import { prisma } from './db.server.ts'
import { describeOrganization } from './organizations.ts'
import { CONTEST_OUTSIDE_TRASH } from './outside-trash.server.ts'
import { countRowsBefore, PAGE_SIZE, toPageNumber } from './page-number.ts'
import type { PageNumber } from './page-number.ts'

export type AdminContest = {
  id: string
  name: string
  educatorName: string
  organizationName: string | null
  approvedCount: number
  /** Whether the organization and global leaderboards leave it out */
  isHidden: boolean
}

/** Hidden contests first, then by name */
export const readAdminContests = async (
  year: number,
  page: number,
): Promise<{ contests: AdminContest[]; page: PageNumber }> => {
  const where = { year, ...CONTEST_OUTSIDE_TRASH }
  const pageNumber = toPageNumber(page, await prisma.contest.count({ where }))
  const contests = await prisma.contest.findMany({
    where,
    orderBy: [{ isHidden: `desc` }, { name: `asc` }, { id: `asc` }],
    skip: countRowsBefore(pageNumber),
    take: PAGE_SIZE,
    select: {
      id: true,
      name: true,
      isHidden: true,
      educator: {
        select: {
          name: true,
          organization: { select: { domain: true, name: true } },
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
    contests: contests.map(({ educator, _count, ...contest }) => ({
      ...contest,
      educatorName: educator.name,
      organizationName:
        educator.organization && describeOrganization(educator.organization),
      approvedCount: _count.players,
    })),
    page: pageNumber,
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
