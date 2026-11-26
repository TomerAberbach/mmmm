import type { Prisma } from './generated/prisma/client.ts'

/**
 * Approving, deleting, and erasing players lock their rows in their own order,
 * so one running alongside this could deadlock with it. Erasing locks players
 * before their submissions, so this does too
 */
export const lockPlayers = async (
  tx: Prisma.TransactionClient,
): Promise<void> => {
  await tx.$executeRaw`LOCK TABLE "Player" IN SHARE ROW EXCLUSIVE MODE`
  await tx.$executeRaw`LOCK TABLE "Submission" IN SHARE ROW EXCLUSIVE MODE`
}
