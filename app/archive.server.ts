import type { Prisma } from './generated/prisma/client.ts'

/**
 * Erases the year's trash and its drafts never submitted. Call it alone, from
 * `withCurrentYearAlone`
 */
export const eraseArchivedYear = async (
  tx: Prisma.TransactionClient,
  year: number,
): Promise<void> => {
  await tx.contest.deleteMany({ where: { year, deletedAt: { not: null } } })
  await tx.player.deleteMany({
    where: {
      contest: { year },
      OR: [{ deletedAt: { not: null } }, { submission: null }],
    },
  })
}
