import {
  isOpen,
  readBracketAndResultRows,
  readCurrentYear,
  readSnapshot,
} from './brackets.server.ts'
import type { Prisma } from './generated/prisma/client.ts'
import type { LeaderboardRow } from './leaderboard-row.ts'
import type { Picks } from './picks.ts'
import { readSubmissionPicks } from './player-picks.server.ts'
import type { Results } from './results.ts'
import type { StoredBracket } from './seeded-bracket.ts'

/** Players see the names in this many of the highest score tiers */
const NAMED_TIERS = 3

/** An approved submission's place, with its name whoever the viewer is */
type RankedSubmission = {
  playerId: string
  displayName: string
  score: number
  rank: number
  /** 1 for the highest score tier */
  tier: number
}

/** A viewer who sees every name, or whose own row and the top tiers have names */
export type LeaderboardViewer =
  { sees: `everyName` } | { sees: `topNames`; ownPlayerId: string }

type LeaderboardContest = { id: string; year: number }

/**
 * The contest's approved submissions by rank, without the names hidden from the
 * viewer. Null while the year is open, when every score is 0
 */
export const readContestLeaderboard = (
  contest: LeaderboardContest,
  viewer: LeaderboardViewer,
): Promise<LeaderboardRow[] | null> =>
  readSnapshot(async tx => {
    if (isOpen(await readCurrentYear(tx), contest.year)) {
      return null
    }
    const rows = await readRankedSubmissions(contest.id, tx)
    return rows.map(row => toRow(row, viewer))
  })

export type LeaderboardSubmission = {
  row: LeaderboardRow
  bracket: StoredBracket
  results: Results
  picks: Picks
}

/**
 * The submission behind a row of the contest's leaderboard. Null when the
 * player has no row, and while the year is open, when no one sees another
 * player's picks
 */
export const readLeaderboardSubmission = (
  contest: LeaderboardContest,
  playerId: string,
  viewer: LeaderboardViewer,
): Promise<LeaderboardSubmission | null> =>
  readSnapshot(async tx => {
    if (isOpen(await readCurrentYear(tx), contest.year)) {
      return null
    }
    const rows = await readRankedSubmissions(contest.id, tx)
    const row = rows.find(candidate => candidate.playerId === playerId)
    return row
      ? {
          row: toRow(row, viewer),
          picks: await readSubmissionPicks(playerId, tx),
          ...(await readBracketAndResultRows(contest.year, tx)),
        }
      : null
  })

const toRow = (
  { playerId, displayName, score, rank, tier }: RankedSubmission,
  viewer: LeaderboardViewer,
): LeaderboardRow => {
  const isOwn = viewer.sees === `topNames` && viewer.ownPlayerId === playerId
  const isNamed = viewer.sees === `everyName` || isOwn || tier <= NAMED_TIERS
  return {
    playerId,
    label: isNamed ? displayName : `Player`,
    score,
    rank,
    isOwn,
  }
}

/**
 * Ties rank by when the picks last changed, earliest first, so only identical
 * times share a rank
 */
const readRankedSubmissions = (
  contestId: string,
  tx: Prisma.TransactionClient,
): Promise<RankedSubmission[]> => tx.$queryRaw`
  SELECT
    "Player"."id" AS "playerId",
    "Player"."displayName",
    "Submission"."score",
    (rank() OVER (
      ORDER BY "Submission"."score" DESC, "Submission"."picksChangedAt"
    ))::int AS "rank",
    (dense_rank() OVER (ORDER BY "Submission"."score" DESC))::int AS "tier"
  FROM "Submission"
  JOIN "Player" ON "Player"."id" = "Submission"."playerId"
  JOIN "Contest" ON "Contest"."id" = "Player"."contestId"
  WHERE "Player"."contestId" = ${contestId}
    AND "Player"."deletedAt" IS NULL
    AND "Contest"."deletedAt" IS NULL
    AND "Submission"."status" = 'APPROVED'
  ORDER BY "rank", "Player"."id"
`
