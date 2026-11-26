import freeEmailDomains from 'free-email-domains'
import { prisma } from './db.server.ts'
import { Prisma } from './generated/prisma/client.ts'
import type { Organization } from './organizations.ts'

/** Providers anyone can get an address from, including disposable ones */
const FREE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  ...freeEmailDomains,
  // Providers and email relays that the package's list lacks
  `hey.com`,
  `mozmail.com`,
  `passinbox.com`,
  `privaterelay.appleid.com`,
])

/** Null for an address at a free email provider */
export const readEmailDomain = (email: string): string | null => {
  const domain = email.slice(email.lastIndexOf(`@`) + 1).toLowerCase()
  return FREE_EMAIL_DOMAINS.has(domain) ? null : domain
}

/**
 * Puts the educator in the organization of their confirmed address's domain, or
 * in none. Does nothing until the address is confirmed
 */
export const joinOrganization = (educatorId: string): Promise<void> =>
  prisma.$transaction(async tx => {
    const educator = await tx.educator.findUnique({
      where: { id: educatorId, emailVerified: true },
      select: { email: true, organizationDomain: true },
    })
    if (!educator) {
      return
    }
    const domain = readEmailDomain(educator.email)
    if (domain === educator.organizationDomain) {
      return
    }
    if (domain !== null) {
      await tx.organization.createMany({
        data: { domain },
        skipDuplicates: true,
      })
    }
    await tx.educator.update({
      where: { id: educatorId },
      data: { organizationDomain: domain },
    })
  })

/** Null for an educator without an organization */
export const readOrganization = async (
  educatorId: string,
): Promise<Organization | null> => {
  const { organization } = await prisma.educator.findUniqueOrThrow({
    where: { id: educatorId },
    select: { organization: { select: { domain: true, name: true } } },
  })
  return organization
}

/**
 * The domain of the organization a contest counts toward, in SQL that joins
 * `Educator`. `readContestOrganization` follows the same rule
 */
export const CONTEST_ORGANIZATION_SQL = Prisma.sql`"Educator"."organizationDomain"`

/** The organization the contest counts toward, if any */
export const readContestOrganization = async (
  contestId: string,
): Promise<Organization | null> => {
  const { educator } = await prisma.contest.findUniqueOrThrow({
    where: { id: contestId },
    select: {
      educator: {
        select: { organization: { select: { domain: true, name: true } } },
      },
    },
  })
  return educator.organization
}

/**
 * Names the educator's organization. Returns whether it had no name yet, since
 * only the admin changes one
 */
export const nameOrganization = async (
  educatorId: string,
  name: string,
): Promise<boolean> => {
  const { count } = await prisma.organization.updateMany({
    where: { name: null, educators: { some: { id: educatorId } } },
    data: { name },
  })
  return count > 0
}

export type OrganizationRow = Organization & { educatorCount: number }

/** By domain */
export const readOrganizations = async (): Promise<OrganizationRow[]> => {
  const organizations = await prisma.organization.findMany({
    orderBy: { domain: `asc` },
    select: {
      domain: true,
      name: true,
      _count: { select: { educators: true } },
    },
  })
  return organizations.map(({ _count, ...organization }) => ({
    ...organization,
    educatorCount: _count.educators,
  }))
}

/** Returns whether the organization exists */
export const renameOrganization = async (
  domain: string,
  name: string,
): Promise<boolean> => {
  const { count } = await prisma.organization.updateMany({
    where: { domain },
    data: { name },
  })
  return count > 0
}
