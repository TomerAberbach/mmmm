import { randomUUID } from 'node:crypto'
import { prisma } from '../app/db.server.ts'
import { joinOrganization } from '../app/organizations.server.ts'

/** Stores an educator with an address of its own, and returns its ID */
export const createEducator = async (
  name = `Ms. Frizzle`,
  { domain = `example.com`, emailVerified = false } = {},
): Promise<string> => {
  const id = randomUUID()
  await prisma.educator.create({
    data: { id, name, email: `${id}@${domain}`, emailVerified },
  })
  return id
}

/** Stores an educator who signed in with an address at the domain */
export const createMember = async (
  domain: string,
  name?: string,
): Promise<string> => {
  const id = await createEducator(name, { domain, emailVerified: true })
  await joinOrganization(id)
  return id
}
