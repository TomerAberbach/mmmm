import type { Contest } from './contests.server.ts'
import { prisma } from './db.server.ts'
import { changeContests } from './editable-contests.server.ts'
import type { Prisma } from './generated/prisma/client.ts'
import { normalizeEmail } from './limits.server.ts'
import { CONTEST_OUTSIDE_TRASH } from './outside-trash.server.ts'

/** A colleague the contest is shared with */
export type Colleague = { id: string; name: string; email: string }

export type SharedContest = Omit<Contest, `link`> & { educatorName: string }

/** Matches contests shared with the educator, in their organization */
export const sharedWith = (educatorId: string): Prisma.ContestWhereInput => ({
  ...CONTEST_OUTSIDE_TRASH,
  educator: { organization: { educators: { some: { id: educatorId } } } },
  shares: { some: { educatorId } },
})

/** Oldest first */
export const readSharedContests = (
  educatorId: string,
  year: number,
): Promise<SharedContest[]> => findShared({ ...sharedWith(educatorId), year })

/** Null unless the contest is shared with the educator */
export const readSharedContest = async (
  educatorId: string,
  contestId: string,
): Promise<SharedContest | null> => {
  const contests = await findShared({
    ...sharedWith(educatorId),
    id: contestId,
  })
  return contests[0] ?? null
}

const findShared = async (
  where: Prisma.ContestWhereInput,
): Promise<SharedContest[]> => {
  const contests = await prisma.contest.findMany({
    where,
    orderBy: [{ createdAt: `asc` }, { id: `asc` }],
    select: {
      id: true,
      name: true,
      year: true,
      isHidden: true,
      educator: { select: { name: true } },
    },
  })
  return contests.map(({ educator, ...contest }) => ({
    ...contest,
    // `sharedWith` matches only contests with an educator
    educatorName: educator!.name,
  }))
}

export const readSharedContestIds = async (
  educatorId: string,
  year: number,
  tx: Prisma.TransactionClient,
): Promise<ReadonlySet<string>> => {
  const contests = await tx.contest.findMany({
    where: { ...sharedWith(educatorId), year },
    select: { id: true },
  })
  return new Set(contests.map(({ id }) => id))
}

/** The colleagues who can open the contest, by name */
export const readColleagues = async (
  contestId: string,
): Promise<Colleague[]> => {
  const shares = await prisma.share.findMany({
    where: {
      contestId,
      educator: {
        organization: {
          educators: { some: { contests: { some: { id: contestId } } } },
        },
      },
    },
    orderBy: [{ educator: { name: `asc` } }, { educatorId: `asc` }],
    select: { educator: { select: { id: true, name: true, email: true } } },
  })
  return shares.map(({ educator }) => educator)
}

export type ShareRefusal = `NO_CONTEST` | `NO_COLLEAGUE` | `OWN_ADDRESS`

/**
 * Shares the educator's contest with the educator of their organization who has
 * the address. Returns null once shared, also when it already was
 */
export const shareContest = (
  educatorId: string,
  contestId: string,
  address: string,
): Promise<ShareRefusal | null> =>
  changeContests<ShareRefusal | null>(educatorId, async (tx, contests) => {
    // The lock keeps the contest out of the trash until the share is added
    await tx.$queryRaw`
      SELECT 1 FROM "Contest" WHERE "id" = ${contestId} FOR SHARE
    `
    const contest = await tx.contest.findFirst({
      where: { ...contests, id: contestId, ...CONTEST_OUTSIDE_TRASH },
      select: { educator: { select: { organizationDomain: true } } },
    })
    if (!contest?.educator) {
      return `NO_CONTEST`
    }
    const { organizationDomain } = contest.educator
    const colleague =
      organizationDomain !== null &&
      (await tx.educator.findUnique({
        where: { email: normalizeEmail(address), organizationDomain },
        select: { id: true },
      }))
    if (!colleague) {
      return `NO_COLLEAGUE`
    }
    if (colleague.id === educatorId) {
      return `OWN_ADDRESS`
    }
    await tx.share.createMany({
      data: { contestId, educatorId: colleague.id },
      skipDuplicates: true,
    })
    return null
  })

/** Returns whether the contest was shared, by the educator who runs it */
export const stopSharing = async (
  educatorId: string,
  contestId: string,
  colleagueId: string,
): Promise<boolean> => {
  const { count } = await prisma.share.deleteMany({
    where: {
      contestId,
      educatorId: colleagueId,
      contest: { educatorId, ...CONTEST_OUTSIDE_TRASH },
    },
  })
  return count > 0
}

/** Ends the shares to and from the educator, who is leaving the organization */
export const endShares = async (
  educatorId: string,
  tx: Prisma.TransactionClient,
): Promise<void> => {
  await tx.share.deleteMany({
    where: { OR: [{ educatorId }, { contest: { educatorId } }] },
  })
}
