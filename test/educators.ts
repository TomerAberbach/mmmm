import { randomUUID } from 'node:crypto'
import { prisma } from '../app/db.server.ts'

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
