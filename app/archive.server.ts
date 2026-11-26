import type { Prisma } from './generated/prisma/client.ts'
import { lockPlayers } from './lock-players.server.ts'

/** Erases the year's trash and its drafts never submitted */
export const eraseArchivedYear = async (
  tx: Prisma.TransactionClient,
  year: number,
): Promise<void> => {
  // Erasing locks players in its own order, so it can't run beside another
  await lockPlayers(tx)
  await tx.contest.deleteMany({ where: { year, deletedAt: { not: null } } })
  await tx.player.deleteMany({
    where: {
      contest: { year },
      OR: [{ deletedAt: { not: null } }, { submission: null }],
    },
  })
}
