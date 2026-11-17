import { randomUUID } from 'node:crypto'
import { lockYear } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import type { LimitRefusal } from './limits.server.ts'
import { createSecret, hashSecret } from './secrets.server.ts'

export type NewPlayer =
  | { secret: string }
  | { refusal: `NOT_CURRENT_YEAR` }
  | { refusal: `LIMITED`; limit: LimitRefusal }

// Starts a player's draft in the contest, and returns their personal link's
// secret, which only the player's cookie and link keep. Only the current
// year's contests take new players. `limit` runs once the contest takes the
// player, so a refused player costs no attempt
export const createPlayer = (
  contestId: string,
  displayName: string,
  limit: () => Promise<LimitRefusal | undefined>,
): Promise<NewPlayer> =>
  prisma.$transaction(async tx => {
    const { yearId } = await tx.contest.findUniqueOrThrow({
      where: { id: contestId },
      select: { yearId: true },
    })
    if ((await lockYear(tx, yearId, `SHARE`)) !== `CURRENT`) {
      return { refusal: `NOT_CURRENT_YEAR` }
    }
    const limitRefusal = await limit()
    if (limitRefusal) {
      return { refusal: `LIMITED`, limit: limitRefusal }
    }
    const secret = createSecret()
    await tx.player.create({
      data: {
        id: randomUUID(),
        contestId,
        displayName,
        personalLinkHash: hashSecret(secret),
      },
    })
    return { secret }
  })

// Null unless the secret is a player's personal link in the contest
export const readContestPlayer = (
  contestId: string,
  secret: string,
): Promise<{ id: string; displayName: string } | null> =>
  prisma.player.findFirst({
    where: { contestId, personalLinkHash: hashSecret(secret) },
    select: { id: true, displayName: true },
  })

// Null for a secret that matches no player
export const readPlayerByLink = async (
  secret: string,
): Promise<{ contestId: string; contestLinkSecret: string } | null> => {
  const player = await prisma.player.findUnique({
    where: { personalLinkHash: hashSecret(secret) },
    select: { contest: { select: { id: true, linkSecret: true } } },
  })
  return (
    player && {
      contestId: player.contest.id,
      contestLinkSecret: player.contest.linkSecret,
    }
  )
}
