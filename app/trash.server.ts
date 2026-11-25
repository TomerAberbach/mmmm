import { prisma } from './db.server.ts'
import type {
  PlayerDeleter,
  SubmissionStatus,
} from './generated/prisma/client.ts'
import {
  CONTEST_OUTSIDE_TRASH,
  educatorPlayers,
  PLAYER_OUTSIDE_TRASH,
} from './outside-trash.server.ts'
import { readEraseCutoff } from './trash.ts'

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
export const deletePlayers = async (
  educatorId: string,
  contestId: string,
  playerIds: string[],
): Promise<number> => {
  const { count } = await prisma.player.updateMany({
    where: {
      id: { in: playerIds },
      ...educatorPlayers(educatorId, contestId),
    },
    data: { deletedAt: new Date(), deletedBy: `EDUCATOR` },
  })
  return count
}

/** Matches players in the trash, only in a contest the educator runs */
const educatorTrash = (
  educatorId: string,
  contestId: string,
  playerIds: string[],
) => ({
  id: { in: playerIds },
  contestId,
  contest: { educatorId, ...CONTEST_OUTSIDE_TRASH },
  deletedAt: { not: null },
})

/** Returns how many players it restored */
export const restorePlayers = async (
  educatorId: string,
  contestId: string,
  playerIds: string[],
): Promise<number> => {
  const { count } = await prisma.player.updateMany({
    where: educatorTrash(educatorId, contestId, playerIds),
    data: { deletedAt: null, deletedBy: null },
  })
  return count
}

/** Deletes players in the trash for good. Returns how many it erased */
export const erasePlayers = async (
  educatorId: string,
  contestId: string,
  playerIds: string[],
): Promise<number> => {
  const { count } = await prisma.player.deleteMany({
    where: educatorTrash(educatorId, contestId, playerIds),
  })
  return count
}

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
  const { count } = await prisma.player.deleteMany({
    where: { deletedBy: `PLAYER`, deletedAt: { lte: readEraseCutoff(now) } },
  })
  return count
}

/** Returns whether it moved the contest, with its players, to the trash */
export const deleteContest = async (
  educatorId: string,
  contestId: string,
): Promise<boolean> => {
  const { count } = await prisma.contest.updateMany({
    where: { id: contestId, educatorId, ...CONTEST_OUTSIDE_TRASH },
    data: { deletedAt: new Date() },
  })
  return count > 0
}

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

/** Matches contests in the educator's trash */
const educatorContestTrash = (educatorId: string, contestIds: string[]) => ({
  id: { in: contestIds },
  educatorId,
  deletedAt: { not: null },
})

/** Returns how many contests it restored, with their players */
export const restoreContests = async (
  educatorId: string,
  contestIds: string[],
): Promise<number> => {
  const { count } = await prisma.contest.updateMany({
    where: educatorContestTrash(educatorId, contestIds),
    data: { deletedAt: null },
  })
  return count
}

/**
 * Deletes contests in the trash for good, with their players. Returns how many
 * it erased
 */
export const eraseContests = async (
  educatorId: string,
  contestIds: string[],
): Promise<number> => {
  const { count } = await prisma.contest.deleteMany({
    where: educatorContestTrash(educatorId, contestIds),
  })
  return count
}
