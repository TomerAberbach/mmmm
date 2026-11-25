import { randomUUID } from 'node:crypto'
import { lockYear } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import type { PlayerDeleter } from './generated/prisma/client.ts'
import type { LimitRefusal } from './limits.server.ts'
import { PLAYER_OUTSIDE_TRASH } from './outside-trash.server.ts'
import { createSecret, hashSecret } from './secrets.server.ts'

export type NewPlayer =
  | { secret: string }
  | { refusal: `NOT_CURRENT_YEAR` | `CONTEST_DELETED` }
  | { refusal: `LIMITED`; limit: LimitRefusal }

/**
 * Starts a player's draft in the contest, and returns their personal link's
 * secret, which only the player's cookie and link keep. Only the current
 * year's contests outside the trash take new players. `limit` runs once the
 * contest takes the player, so a refused player costs no attempt
 */
export const createPlayer = (
  contestId: string,
  displayName: string,
  limit: () => Promise<LimitRefusal | undefined>,
): Promise<NewPlayer> =>
  prisma.$transaction(async tx => {
    // The request may have read the contest before another deleted it
    const [contest] = await tx.$queryRaw<
      { year: number; deletedAt: Date | null }[]
    >`
      SELECT "year", "deletedAt" FROM "Contest" WHERE "id" = ${contestId} FOR SHARE
    `
    if (!contest || contest.deletedAt) {
      return { refusal: `CONTEST_DELETED` }
    }
    if ((await lockYear(tx, contest.year, `SHARE`)) !== `CURRENT`) {
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

/**
 * Null unless the secret is a player's personal link in the contest. Deleting a
 * player turns off their link
 */
export const readContestPlayer = (
  contestId: string,
  secret: string,
): Promise<{ id: string; displayName: string } | null> =>
  prisma.player.findFirst({
    where: {
      contestId,
      personalLinkHash: hashSecret(secret),
      ...PLAYER_OUTSIDE_TRASH,
    },
    select: { id: true, displayName: true },
  })

/** Where a personal link leads. A deleted contest or player turns it off */
export type PersonalLinkTarget =
  | { state: `active`; contestId: string; contestLinkSecret: string }
  | { state: `contestDeleted` }
  | {
      state: `deleted`
      deletedBy: PlayerDeleter
      deletedAt: Date
      contestLinkSecret: string
      year: number
    }

/** Null for a secret that matches no player */
export const readPersonalLink = async (
  secret: string,
): Promise<PersonalLinkTarget | null> => {
  const player = await prisma.player.findUnique({
    where: { personalLinkHash: hashSecret(secret) },
    select: {
      deletedAt: true,
      deletedBy: true,
      contest: {
        select: { id: true, linkSecret: true, year: true, deletedAt: true },
      },
    },
  })
  if (!player) {
    return null
  }
  const { contest, deletedAt, deletedBy } = player
  if (contest.deletedAt) {
    return { state: `contestDeleted` }
  }
  return deletedAt && deletedBy
    ? {
        state: `deleted`,
        deletedBy,
        deletedAt,
        contestLinkSecret: contest.linkSecret,
        year: contest.year,
      }
    : {
        state: `active`,
        contestId: contest.id,
        contestLinkSecret: contest.linkSecret,
      }
}
