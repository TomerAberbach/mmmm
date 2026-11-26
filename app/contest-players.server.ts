import { prisma } from './db.server.ts'
import { changeContests, editablePlayers } from './editable-contests.server.ts'
import type { Prisma, SubmissionStatus } from './generated/prisma/client.ts'
import { UNNAMED_PLAYER } from './leaderboard-row.ts'
import { areNamesRemoved } from './name-removal.server.ts'
import { PLAYER_OUTSIDE_TRASH } from './outside-trash.server.ts'
import type { Decision } from './player-forms.ts'
import { createSecret, hashSecret } from './secrets.server.ts'

/**
 * A player in an educator's contest. `status` and `score` are null for a draft
 */
export type ContestPlayer = {
  id: string
  displayName: string
  startedAt: Date
  status: SubmissionStatus | null
  score: number | null
}

/** Whether the contest has the player, with a name to report */
export const hasReportablePlayer = async (
  { id: contestId, year }: { id: string; year: number },
  playerId: string,
): Promise<boolean> =>
  (await prisma.player.count({
    where: {
      id: playerId,
      contestId,
      ...(areNamesRemoved(year, new Date())
        ? { displayName: { not: UNNAMED_PLAYER } }
        : {}),
      ...PLAYER_OUTSIDE_TRASH,
    },
  })) > 0

/** Drafts are oldest first either way. Scores order as leaderboards do */
export const readContestPlayers = async (
  contestId: string,
  order: `OLDEST_FIRST` | `HIGHEST_SCORE_FIRST`,
): Promise<ContestPlayer[]> => {
  const players = await prisma.player.findMany({
    where: { contestId, ...PLAYER_OUTSIDE_TRASH },
    orderBy: [
      ...(order === `HIGHEST_SCORE_FIRST` ? SCORE_ORDER : []),
      { createdAt: `asc` },
      { id: `asc` },
    ],
    select: {
      id: true,
      displayName: true,
      createdAt: true,
      submission: { select: { status: true, score: true } },
    },
  })
  return players.map(({ id, displayName, createdAt, submission }) => ({
    id,
    displayName,
    startedAt: createdAt,
    status: submission?.status ?? null,
    score: submission?.score ?? null,
  }))
}

/** Tied scores order by when the picks last changed, earliest first */
const SCORE_ORDER = [
  { submission: { score: `desc` } },
  { submission: { picksChangedAt: `asc` } },
] satisfies Prisma.PlayerOrderByWithRelationInput[]

/**
 * Returns how many of the players have a submission in a contest the educator
 * runs. An educator can change a submission's status until the year is past
 */
export const setSubmissionStatus = (
  educatorId: string,
  contestId: string,
  playerIds: string[],
  status: Decision,
): Promise<number> =>
  changeContests(educatorId, async (tx, contests) => {
    const { count } = await tx.submission.updateMany({
      where: {
        playerId: { in: playerIds },
        player: editablePlayers(contests, contestId),
      },
      data: { status },
    })
    return count
  })

/** Returns whether the player is in a contest the educator runs */
export const renamePlayer = (
  educatorId: string,
  contestId: string,
  playerId: string,
  displayName: string,
): Promise<boolean> =>
  changeContests(educatorId, async (tx, contests) => {
    const { count } = await tx.player.updateMany({
      where: { id: playerId, ...editablePlayers(contests, contestId) },
      data: { displayName },
    })
    return count > 0
  })

/**
 * Replaces the player's personal link, so the old one stops working, also in
 * browsers that remember it. Returns the new link's secret, or null unless the
 * player is in a contest the educator runs
 */
export const replacePersonalLink = (
  educatorId: string,
  contestId: string,
  playerId: string,
): Promise<string | null> =>
  changeContests(educatorId, async (tx, contests) => {
    const secret = createSecret()
    const { count } = await tx.player.updateMany({
      where: { id: playerId, ...editablePlayers(contests, contestId) },
      data: { personalLinkHash: hashSecret(secret) },
    })
    return count > 0 ? secret : null
  })
