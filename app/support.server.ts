import { withCurrentYear } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import type { Prisma } from './generated/prisma/client.ts'
import { normalizeEmail } from './limits.server.ts'
import { lockPlayers } from './lock-players.server.ts'
import { describeOrganization } from './organizations.ts'
import { CONTEST_OUTSIDE_TRASH } from './outside-trash.server.ts'

export type FoundEducator = {
  id: string
  name: string
  email: string
  isConfirmed: boolean
  organizationName: string | null
  contestCount: number
  createdAt: Date
}

/** Null when no educator has the address */
export const findEducator = async (
  address: string,
): Promise<FoundEducator | null> => {
  const educator = await prisma.educator.findUnique({
    where: { email: normalizeEmail(address) },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      createdAt: true,
      organization: { select: { domain: true, name: true } },
      _count: { select: { contests: { where: CONTEST_OUTSIDE_TRASH } } },
    },
  })
  if (!educator) {
    return null
  }
  const { emailVerified, organization, _count, ...found } = educator
  return {
    ...found,
    isConfirmed: emailVerified,
    organizationName: organization && describeOrganization(organization),
    contestCount: _count.contests,
  }
}

/**
 * Gives an orphaned contest to a confirmed educator, with its trash and pending
 * submissions. Returns whether both still are
 */
export const handOverContest = (
  contestId: string,
  educatorId: string,
): Promise<boolean> =>
  prisma.$transaction(async tx => {
    const educator = await tx.educator.findUnique({
      where: { id: educatorId, emailVerified: true },
      select: { id: true },
    })
    if (!educator) {
      return false
    }
    const { count } = await tx.contest.updateMany({
      where: { id: contestId, educatorId: null, ...CONTEST_OUTSIDE_TRASH },
      data: { educatorId, orphanedFromDomain: null },
    })
    return count > 0
  })

/**
 * Deletes the organization with its educators and every contest that counts
 * toward it, in any year and in the trash. Returns whether it existed, and
 * refuses the one the admin is in
 */
export const deleteOrganization = (
  domain: string,
  adminId: string,
): Promise<`DELETED` | `GONE` | `OWN`> =>
  // Takes the year lock before any row, as every other change does
  withCurrentYear(async tx => {
    await lockPlayers(tx)
    // A contest created or orphaned meanwhile would keep the organization
    await tx.$queryRaw`
      SELECT 1 FROM "Educator"
      WHERE "organizationDomain" = ${domain} OR "email" LIKE ${`%@${domain}`}
      ORDER BY "id" FOR UPDATE
    `
    const organization = await tx.organization.findUnique({
      where: { domain },
      select: { domain: true },
    })
    if (!organization) {
      return `GONE`
    }
    const educators = organizationEducators(domain)
    if (
      (await tx.educator.count({ where: { id: adminId, ...educators } })) > 0
    ) {
      return `OWN`
    }
    await tx.contest.deleteMany({ where: organizationContests(domain) })
    await tx.educator.deleteMany({ where: educators })
    await tx.organization.delete({ where: { domain } })
    return `DELETED`
  })

/** Includes those who haven't signed in yet, so haven't joined */
const organizationEducators = (domain: string): Prisma.EducatorWhereInput => ({
  OR: [{ organizationDomain: domain }, { email: { endsWith: `@${domain}` } }],
})

const organizationContests = (domain: string): Prisma.ContestWhereInput => ({
  OR: [
    { educator: organizationEducators(domain) },
    { orphanedFromDomain: domain },
  ],
})

export type OrganizationData = {
  educatorCount: number
  contestCount: number
  playerCount: number
}

/** What `deleteOrganization` would delete */
export const countOrganizationData = async (
  domain: string,
): Promise<OrganizationData> => {
  const contest = organizationContests(domain)
  const [educatorCount, contestCount, playerCount] = await Promise.all([
    prisma.educator.count({ where: organizationEducators(domain) }),
    prisma.contest.count({ where: contest }),
    prisma.player.count({ where: { contest } }),
  ])
  return { educatorCount, contestCount, playerCount }
}
