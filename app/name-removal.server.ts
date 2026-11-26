import { prisma } from './db.server.ts'
import type { Prisma } from './generated/prisma/client.ts'
import { UNNAMED_PLAYER } from './leaderboard-row.ts'
import { lockPlayers } from './lock-players.server.ts'
import { readArizonaDate } from './year.ts'

/**
 * Removes the display names of players in tournaments that ended two years ago
 * or earlier, and returns how many it removed. Their picks, scores, and ranks
 * stay, and reports of them go, since they point at a name
 */
export const removeExpiredNames = async (now: Date): Promise<number> => {
  const expired = {
    displayName: { not: UNNAMED_PLAYER },
    contest: {
      year: { lte: readNameRemovalYear(now) },
      // A tournament without results hasn't ended
      bracket: { lockedAt: { not: null } },
    },
  } satisfies Prisma.PlayerWhereInput
  if ((await prisma.player.count({ where: expired })) === 0) {
    return 0
  }
  return prisma.$transaction(async tx => {
    await lockPlayers(tx)
    await tx.report.deleteMany({ where: { player: expired } })
    const { count } = await tx.player.updateMany({
      where: expired,
      data: { displayName: UNNAMED_PLAYER },
    })
    return count
  })
}

/** The newest year whose tournament ended two years ago or earlier */
export const readNameRemovalYear = (now: Date): number => {
  const { year, month } = readArizonaDate(now)
  return year - YEARS_KEPT - (month < END_MONTH ? 1 : 0)
}

const YEARS_KEPT = 2

/** May, by when a year's tournament has ended */
const END_MONTH = 5
