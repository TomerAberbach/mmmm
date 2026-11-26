import { prisma } from './db.server.ts'
import type { Prisma } from './generated/prisma/client.ts'
import { normalizeEmail } from './limits.server.ts'
import { CONTEST_OUTSIDE_TRASH } from './outside-trash.server.ts'
import { endShares } from './shares.server.ts'

/**
 * Deletes the educator's account. Their contests become orphaned, which keeps
 * the organization they count toward. Returns whether the address is the
 * account's
 */
export const deleteEducator = (
  educatorId: string,
  address: string,
): Promise<boolean> =>
  prisma.$transaction(async tx => {
    const educator = await tx.educator.findUnique({
      where: { id: educatorId },
      select: { email: true },
    })
    if (educator?.email !== normalizeEmail(address)) {
      return false
    }
    await orphanContestsAndDelete(tx, educatorId)
    return true
  })

const orphanContestsAndDelete = async (
  tx: Prisma.TransactionClient,
  educatorId: string,
): Promise<void> => {
  // A contest created meanwhile would keep the account, and a share added
  // meanwhile would outlast it
  await tx.$queryRaw`
    SELECT 1 FROM "Educator" WHERE "id" = ${educatorId} FOR UPDATE
  `
  await tx.$queryRaw`
    SELECT 1 FROM "Contest" WHERE "educatorId" = ${educatorId}
    ORDER BY "id" FOR NO KEY UPDATE
  `
  const { organizationDomain } = await tx.educator.findUniqueOrThrow({
    where: { id: educatorId },
    select: { organizationDomain: true },
  })
  await endShares(educatorId, tx)
  await tx.contest.updateMany({
    where: { educatorId },
    data: { educatorId: null, orphanedFromDomain: organizationDomain },
  })
  await tx.educator.delete({ where: { id: educatorId } })
}

/** Counts every year's contests */
export const countContests = (educatorId: string): Promise<number> =>
  prisma.contest.count({ where: { educatorId, ...CONTEST_OUTSIDE_TRASH } })

/**
 * An unconfirmed educator belongs to no one yet, so whoever confirms the address
 * next replaces them, unless they have contests. Returns whether the address is
 * free. The condition keeps one whose address is confirmed meanwhile
 */
export const freeAddress = async (
  email: string,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> => {
  await db.educator.deleteMany({ where: { email, ...REPLACEABLE } })
  return (await db.educator.count({ where: { email } })) === 0
}

/** Whether `freeAddress` would free it */
export const isAddressFree = async (email: string): Promise<boolean> =>
  (await prisma.educator.count({ where: { email, NOT: REPLACEABLE } })) === 0

const REPLACEABLE = {
  emailVerified: false,
  contests: { none: {} },
} satisfies Prisma.EducatorWhereInput
