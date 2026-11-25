import { prisma } from './db.server.ts'
import type { SubmissionStatus } from './generated/prisma/client.ts'
import {
  educatorPlayers,
  PLAYER_OUTSIDE_TRASH,
} from './outside-trash.server.ts'
import type { Decision } from './player-forms.ts'

/** A player in an educator's contest. `status` is null for a draft */
export type ContestPlayer = {
  id: string
  displayName: string
  startedAt: Date
  status: SubmissionStatus | null
}

/** Oldest first */
export const readContestPlayers = async (
  contestId: string,
): Promise<ContestPlayer[]> => {
  const players = await prisma.player.findMany({
    where: { contestId, ...PLAYER_OUTSIDE_TRASH },
    orderBy: [{ createdAt: `asc` }, { id: `asc` }],
    select: {
      id: true,
      displayName: true,
      createdAt: true,
      submission: { select: { status: true } },
    },
  })
  return players.map(({ id, displayName, createdAt, submission }) => ({
    id,
    displayName,
    startedAt: createdAt,
    status: submission?.status ?? null,
  }))
}

/**
 * Returns how many of the players have a submission in a contest the educator
 * runs. An educator can change a submission's status at any time
 */
export const setSubmissionStatus = async (
  educatorId: string,
  contestId: string,
  playerIds: string[],
  status: Decision,
): Promise<number> => {
  const { count } = await prisma.submission.updateMany({
    where: {
      playerId: { in: playerIds },
      player: educatorPlayers(educatorId, contestId),
    },
    data: { status },
  })
  return count
}

/**
 * Approves those of the players whose submissions are still pending, so a
 * submission that arrives after the educator read the list waits for them.
 * Returns how many it approved
 */
export const approvePendingSubmissions = async (
  educatorId: string,
  contestId: string,
  playerIds: string[],
): Promise<number> => {
  const { count } = await prisma.submission.updateMany({
    where: {
      status: `PENDING`,
      playerId: { in: playerIds },
      player: educatorPlayers(educatorId, contestId),
    },
    data: { status: `APPROVED` },
  })
  return count
}

/** Returns whether the player is in a contest the educator runs */
export const renamePlayer = async (
  educatorId: string,
  contestId: string,
  playerId: string,
  displayName: string,
): Promise<boolean> => {
  const { count } = await prisma.player.updateMany({
    where: { id: playerId, ...educatorPlayers(educatorId, contestId) },
    data: { displayName },
  })
  return count > 0
}
