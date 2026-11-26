import { prisma } from './db.server.ts'

/**
 * Deletes expired sessions, emailed links, and sign-in challenges, and returns
 * how many it deleted
 */
export const deleteExpiredSignIns = async (now: Date): Promise<number> => {
  const where = { expiresAt: { lt: now } }
  const sessions = await prisma.session.deleteMany({ where })
  const verifications = await prisma.verification.deleteMany({ where })
  return sessions.count + verifications.count
}
