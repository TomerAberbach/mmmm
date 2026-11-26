import { withCurrentYear } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import type { Prisma } from './generated/prisma/client.ts'
import { normalizeEmail } from './limits.server.ts'
import { ensureOrganization } from './organizations.server.ts'
import { CONTEST_OUTSIDE_TRASH } from './outside-trash.server.ts'
import { endShares } from './shares.server.ts'

/**
 * Deletes the educator's account. Their contests become orphaned, which keeps
 * the organization they count toward. An unconfirmed educator's contests are
 * hidden, since no one confirmed them, and keep their address's organization, so
 * `deleteOrganization` finds them. Returns whether the address is the account's
 */
export const deleteEducator = async (
  educatorId: string,
  address: string,
): Promise<boolean> => {
  const isDeleted = await orphanAndDelete(educatorId, address)
  if (isDeleted) {
    await deleteEmailedLinks([educatorId])
  }
  return isDeleted
}

/**
 * Deletes links already sent to deleted educators, which can hold another
 * address. Call it after the transaction that deletes them, since using a link
 * locks it before the educator
 */
export const deleteEmailedLinks = async (
  educatorIds: readonly string[],
): Promise<void> => {
  await prisma.verification.deleteMany({
    where: { OR: educatorIds.map(id => ({ value: { contains: id } })) },
  })
}

const orphanAndDelete = (
  educatorId: string,
  address: string,
): Promise<boolean> =>
  withCurrentYear(async tx => {
    // A contest created meanwhile would keep the account, and a share added
    // meanwhile would outlast it
    await tx.$queryRaw`
      SELECT 1 FROM "Educator" WHERE "id" = ${educatorId} FOR UPDATE
    `
    await tx.$queryRaw`
      SELECT 1 FROM "Contest" WHERE "educatorId" = ${educatorId}
      ORDER BY "id" FOR NO KEY UPDATE
    `
    const educator = await tx.educator.findUnique({
      where: { id: educatorId },
      select: { email: true, emailVerified: true, organizationDomain: true },
    })
    if (educator?.email !== normalizeEmail(address)) {
      return false
    }
    await endShares(educatorId, tx)
    await tx.contest.updateMany({
      where: { educatorId },
      data: {
        educatorId: null,
        ...(!educator.emailVerified && { isHidden: true }),
        orphanedFromDomain: educator.emailVerified
          ? educator.organizationDomain
          : await ensureOrganization(educator.email, tx),
      },
    })
    await tx.educator.delete({ where: { id: educatorId } })
    return true
  })

/** Counts every year's contests */
export const countContests = (educatorId: string): Promise<number> =>
  prisma.contest.count({ where: { educatorId, ...CONTEST_OUTSIDE_TRASH } })

/**
 * An unconfirmed educator belongs to no one yet, so whoever confirms the address
 * next replaces them, unless they have contests. Returns whether the address is
 * free. The condition keeps one whose address is confirmed meanwhile
 */
export const freeAddress = async (
  address: string,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> => {
  const email = normalizeEmail(address)
  await db.educator.deleteMany({ where: { email, ...REPLACEABLE } })
  return (await db.educator.count({ where: { email } })) === 0
}

/** Whether `freeAddress` would free it */
export const isAddressFree = async (address: string): Promise<boolean> =>
  (await prisma.educator.count({
    where: { email: normalizeEmail(address), NOT: REPLACEABLE },
  })) === 0

const REPLACEABLE = {
  emailVerified: false,
  contests: { none: {} },
} satisfies Prisma.EducatorWhereInput
