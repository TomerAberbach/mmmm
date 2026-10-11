import type { PrismaClient } from './generated/prisma/client.ts'

type DatabaseHealth = `up` | `down`

export const checkDatabase = async (
  prisma: Pick<PrismaClient, `$queryRaw`>,
): Promise<DatabaseHealth> => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return `up`
  } catch (error) {
    console.error(`Database health check failed`, error)
    return `down`
  }
}
