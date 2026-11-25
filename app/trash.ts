import type { PlayerDeleter } from './generated/prisma/enums.ts'

export const PLAYER_DELETION_DAYS = 7

const PLAYER_DELETION_MILLISECONDS = PLAYER_DELETION_DAYS * 24 * 60 * 60 * 1000

/**
 * When a deleted player is erased, or null for one an educator deleted, who
 * waits until the next bracket is published
 */
export const readEraseTime = ({
  deletedAt,
  deletedBy,
}: {
  deletedAt: Date
  deletedBy: PlayerDeleter
}): Date | null =>
  deletedBy === `PLAYER`
    ? new Date(deletedAt.getTime() + PLAYER_DELETION_MILLISECONDS)
    : null

/** The newest `deletedAt` whose erase time has come by `now` */
export const readEraseCutoff = (now: Date): Date =>
  new Date(now.getTime() - PLAYER_DELETION_MILLISECONDS)
