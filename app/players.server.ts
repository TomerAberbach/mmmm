import { randomUUID } from 'node:crypto'
import { href } from 'react-router'
import { isCurrentYear, withCurrentYear } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import { toAppUrl } from './env.server.ts'
import type { LimitRefusal } from './limits.server.ts'
import { PLAYER_OUTSIDE_TRASH } from './outside-trash.server.ts'
import { createSecret, hashSecret } from './secrets.server.ts'
import { readEraseTime } from './trash.ts'

export type NewPlayer =
  | { secret: string }
  | { refusal: `NOT_CURRENT_YEAR` | `CONTEST_DELETED` | `BROKEN_LINK` }
  | { refusal: `LIMITED`; limit: LimitRefusal }

/**
 * Starts a player's draft in the contest whose contest link has the secret, and
 * returns their personal link's secret, which only the player's cookie and link
 * keep. Only the current year's contests outside the trash take new players.
 * `limit` runs once the contest takes the player, so a refused player costs no
 * attempt
 */
export const createPlayer = (
  linkSecret: string,
  displayName: string,
  limit: () => Promise<LimitRefusal | undefined>,
): Promise<NewPlayer> =>
  withCurrentYear(async (tx, currentYear) => {
    // The request may have read the contest before another deleted it or
    // replaced its contest link
    const [contest] = await tx.$queryRaw<
      {
        id: string
        year: number
        linkVersion: number
        deletedAt: Date | null
      }[]
    >`
      SELECT "id", "year", "linkVersion", "deletedAt" FROM "Contest" WHERE "linkSecret" = ${linkSecret} FOR SHARE
    `
    if (!contest) {
      return { refusal: `BROKEN_LINK` }
    }
    if (contest.deletedAt) {
      return { refusal: `CONTEST_DELETED` }
    }
    if (contest.year !== currentYear) {
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
        contestId: contest.id,
        linkVersion: contest.linkVersion,
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
  | { state: `active`; contestId: string }
  | { state: `contestDeleted` }
  | {
      state: `deleted`
      /** When the daily job erases the player, or null when it doesn't */
      restoreBy: Date | null
      /**
       * The contest link where the player starts a new bracket. Null when the
       * contest takes no players, or its contest link was replaced after the
       * player started, since that keeps out whoever started with the old one
       */
      startLinkSecret: string | null
    }

/** Null for a secret that matches no player */
export const readPersonalLink = async (
  secret: string,
): Promise<PersonalLinkTarget | null> => {
  const player = await prisma.player.findUnique({
    where: { personalLinkHash: hashSecret(secret) },
    select: {
      linkVersion: true,
      deletedAt: true,
      deletedBy: true,
      contest: {
        select: {
          id: true,
          linkSecret: true,
          linkVersion: true,
          year: true,
          deletedAt: true,
        },
      },
    },
  })
  if (!player) {
    return null
  }
  const { contest, linkVersion, deletedAt, deletedBy } = player
  if (contest.deletedAt) {
    return { state: `contestDeleted` }
  }
  return deletedAt && deletedBy
    ? {
        state: `deleted`,
        restoreBy: readEraseTime({ deletedAt, deletedBy }),
        startLinkSecret:
          linkVersion === contest.linkVersion &&
          (await isCurrentYear(contest.year))
            ? contest.linkSecret
            : null,
      }
    : {
        state: `active`,
        contestId: contest.id,
      }
}

export const toPersonalLink = (secret: string): string =>
  toAppUrl(href(`/my-bracket/:secret`, { secret })).href
