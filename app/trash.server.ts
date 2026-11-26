import { isSameName } from './bracket-input.ts'
import { prisma } from './db.server.ts'
import { changeContests, editablePlayers } from './editable-contests.server.ts'
import type { EditableContests } from './editable-contests.server.ts'
import type {
  PlayerDeleter,
  Prisma,
  SubmissionStatus,
} from './generated/prisma/client.ts'
import {
  CONTEST_OUTSIDE_TRASH,
  PLAYER_OUTSIDE_TRASH,
} from './outside-trash.server.ts'
import { readEraseCutoff } from './trash.ts'
import { withCurrentYearAlone } from './years.server.ts'

/** A player in a contest's trash. `status` is null for a draft */
export type DeletedPlayer = {
  id: string
  displayName: string
  status: SubmissionStatus | null
  deletedAt: Date
  deletedBy: PlayerDeleter
}

/** Most recently deleted first */
export const readDeletedPlayers = async (
  contestId: string,
): Promise<DeletedPlayer[]> => {
  const players = await prisma.player.findMany({
    where: { contestId, deletedAt: { not: null } },
    orderBy: [{ deletedAt: `desc` }, { id: `asc` }],
    select: {
      id: true,
      displayName: true,
      deletedAt: true,
      deletedBy: true,
      submission: { select: { status: true } },
    },
  })
  return players.map(({ deletedAt, deletedBy, submission, ...player }) => ({
    ...player,
    status: submission?.status ?? null,
    // The query and the CHECK constraint leave neither null
    deletedAt: deletedAt!,
    deletedBy: deletedBy!,
  }))
}

export const countDeletedPlayers = (contestId: string): Promise<number> =>
  prisma.player.count({ where: { contestId, deletedAt: { not: null } } })

/**
 * Moves the players to the contest's trash, which turns off their personal
 * links. Returns how many it moved
 */
export const deletePlayers = (
  educatorId: string,
  contestId: string,
  playerIds: string[],
): Promise<number> =>
  changeContests(educatorId, async (tx, contests) => {
    const { count } = await tx.player.updateMany({
      where: {
        id: { in: playerIds },
        ...editablePlayers(contests, contestId),
      },
      data: { deletedAt: new Date(), deletedBy: `EDUCATOR` },
    })
    return count
  })

/**
 * Matches players in the trash of one of the contests. A player can delete
 * themselves in a past year, so it matches those in any of the educator's
 */
const deletedPlayers = (
  contests: EditableContests,
  contestId: string,
  playerIds: string[],
) => ({
  id: { in: playerIds },
  contestId,
  deletedAt: { not: null },
  OR: [
    { contest: { ...contests, ...CONTEST_OUTSIDE_TRASH } },
    {
      deletedBy: `PLAYER` as const,
      contest: { educatorId: contests.educatorId, ...CONTEST_OUTSIDE_TRASH },
    },
  ],
})

/** Returns how many players it restored */
export const restorePlayers = (
  educatorId: string,
  contestId: string,
  playerIds: string[],
): Promise<number> =>
  changeContests(educatorId, async (tx, contests) => {
    const { count } = await tx.player.updateMany({
      where: deletedPlayers(contests, contestId, playerIds),
      data: { deletedAt: null, deletedBy: null },
    })
    return count
  })

/** Deletes players in the trash for good. Returns how many it erased */
export const erasePlayers = (
  educatorId: string,
  contestId: string,
  playerIds: string[],
): Promise<number> =>
  changeContests(educatorId, async (tx, contests) => {
    const { count } = await tx.player.deleteMany({
      where: deletedPlayers(contests, contestId, playerIds),
    })
    return count
  })

/**
 * The admin deletes a player for good, such as for a family, in any year and
 * even when the player or the contest is in the trash. Returns whether the
 * player was in the contest
 */
export const erasePlayer = (
  contestId: string,
  playerId: string,
): Promise<boolean> =>
  // Alone, since changes to the contest lock its players in another order
  withCurrentYearAlone(async tx => {
    const { count } = await tx.player.deleteMany({
      where: { id: playerId, contestId },
    })
    return count > 0
  })

/** Restores the contest if it's in the trash and orphaned, in any year */
export const restoreOrphanedContest = async (
  contestId: string,
  tx: Prisma.TransactionClient,
): Promise<void> => {
  await tx.contest.updateMany({
    where: { id: contestId, educatorId: null },
    data: { deletedAt: null },
  })
}

/**
 * The admin deletes a contest for good, with its players and reports, in any
 * year and even outside the trash. `OTHER_NAME` means `name` isn't the
 * contest's, so the admin may have confirmed another
 */
export const eraseContest = (
  contestId: string,
  name: string,
): Promise<`ERASED` | `GONE` | `OTHER_NAME`> =>
  // Alone, since changes to the contest lock its players in another order
  withCurrentYearAlone(async tx => {
    const contest = await tx.contest.findUnique({
      where: { id: contestId },
      select: { name: true },
    })
    if (!contest) {
      return `GONE`
    }
    if (!isSameName(contest.name, name)) {
      return `OTHER_NAME`
    }
    await tx.contest.deleteMany({ where: { id: contestId } })
    return `ERASED`
  })

/**
 * A player moves their own draft or submission to the trash. Returns whether it
 * was outside the trash
 */
export const deleteOwnPlayer = async (playerId: string): Promise<boolean> => {
  const { count } = await prisma.player.updateMany({
    where: { id: playerId, ...PLAYER_OUTSIDE_TRASH },
    data: { deletedAt: new Date(), deletedBy: `PLAYER` },
  })
  return count > 0
}

/**
 * Erases the players who deleted themselves 7 days ago or earlier, and returns
 * how many it erased
 */
export const eraseExpiredPlayers = async (now: Date): Promise<number> => {
  const expired = {
    deletedBy: `PLAYER`,
    deletedAt: { lte: readEraseCutoff(now) },
  } satisfies Prisma.PlayerWhereInput
  if ((await prisma.player.count({ where: expired })) === 0) {
    return 0
  }
  // Alone, since restoring players locks their rows in another order
  return withCurrentYearAlone(async tx => {
    const { count } = await tx.player.deleteMany({ where: expired })
    return count
  })
}

/** Returns whether it moved the contest, with its players, to the trash */
export const deleteContest = (
  educatorId: string,
  contestId: string,
): Promise<boolean> =>
  changeContests(educatorId, async (tx, contests) => {
    const { count } = await tx.contest.updateMany({
      where: { id: contestId, ...contests, ...CONTEST_OUTSIDE_TRASH },
      data: { deletedAt: new Date() },
    })
    return count > 0
  })

/** The counts leave out players in the contest's own trash */
export type DeletedContest = {
  id: string
  name: string
  deletedAt: Date
  submissionCount: number
  draftCount: number
}

/** Most recently deleted first */
export const readDeletedContests = async (
  educatorId: string,
  year: number,
): Promise<DeletedContest[]> => {
  const contests = await prisma.contest.findMany({
    where: { educatorId, year, deletedAt: { not: null } },
    orderBy: [{ deletedAt: `desc` }, { id: `asc` }],
    select: {
      id: true,
      name: true,
      deletedAt: true,
      players: {
        where: { deletedAt: null },
        select: { submission: { select: { playerId: true } } },
      },
    },
  })
  return contests.map(({ deletedAt, players, ...contest }) => {
    const submissionCount = players.filter(
      ({ submission }) => submission !== null,
    ).length
    return {
      ...contest,
      deletedAt: deletedAt!,
      submissionCount,
      draftCount: players.length - submissionCount,
    }
  })
}

export const countDeletedContests = (
  educatorId: string,
  year: number,
): Promise<number> =>
  prisma.contest.count({
    where: { educatorId, year, deletedAt: { not: null } },
  })

/** Matches those of the contests in the trash */
const deletedContests = (contests: EditableContests, contestIds: string[]) => ({
  ...contests,
  id: { in: contestIds },
  deletedAt: { not: null },
})

/** Returns how many contests it restored, with their players */
export const restoreContests = (
  educatorId: string,
  contestIds: string[],
): Promise<number> =>
  changeContests(educatorId, async (tx, contests) => {
    const { count } = await tx.contest.updateMany({
      where: deletedContests(contests, contestIds),
      data: { deletedAt: null },
    })
    return count
  })

/**
 * Deletes contests in the trash for good, with their players. Returns how many
 * it erased
 */
export const eraseContests = (
  educatorId: string,
  contestIds: string[],
): Promise<number> =>
  changeContests(educatorId, async (tx, contests) => {
    const { count } = await tx.contest.deleteMany({
      where: deletedContests(contests, contestIds),
    })
    return count
  })
