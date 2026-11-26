import { prisma } from './db.server.ts'
import type { SubmissionStatus } from './generated/prisma/client.ts'
import {
  educatorPlayers,
  PLAYER_OUTSIDE_TRASH,
} from './outside-trash.server.ts'
import type { Decision } from './player-forms.ts'
import { createSecret, hashSecret } from './secrets.server.ts'

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

/**
 * Replaces the player's personal link, so the old one stops working, also in
 * browsers that remember it. Returns the new link's secret, or null unless the
 * player is in a contest the educator runs
 */
export const replacePersonalLink = async (
  educatorId: string,
  contestId: string,
  playerId: string,
): Promise<string | null> => {
  const secret = createSecret()
  const { count } = await prisma.player.updateMany({
    where: { id: playerId, ...educatorPlayers(educatorId, contestId) },
    data: { personalLinkHash: hashSecret(secret) },
  })
  return count > 0 ? secret : null
}
