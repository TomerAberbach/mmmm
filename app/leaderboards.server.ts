import {
  isOpen,
  readBracketAndResultRows,
  readCurrentYear,
  readSnapshot,
} from './brackets.server.ts'
import { Prisma } from './generated/prisma/client.ts'
import type { LeaderboardPage, LeaderboardRow } from './leaderboard-row.ts'
import { CONTEST_ORGANIZATION_SQL } from './organizations.server.ts'
import type { Picks } from './picks.ts'
import { readSubmissionPicks } from './player-picks.server.ts'
import type { Results } from './results.ts'
import type { StoredBracket } from './seeded-bracket.ts'

/** Whose approved submissions a leaderboard ranks, in one year */
export type LeaderboardScope = { year: number } & (
  | { kind: `contest`; contestId: string }
  | { kind: `organization`; domain: string }
)

/**
 * An educator sees every name in their own contests. A player sees their own
 * name and the top score tiers' in their own contest. No other name leaves its
 * contest
 */
export type LeaderboardViewer =
  | { kind: `educator`; educatorId: string }
  | { kind: `player`; contestId: string; playerId: string }

const LEADERBOARD_PAGE_SIZE = 100

/** Players see the names in this many of their contest's highest score tiers */
const NAMED_TIERS = 3

/**
 * A page of the scope's approved submissions by rank, without the names hidden
 * from the viewer. `page` counts from 1. Null while the year is open, when every
 * score is 0
 */
export const readLeaderboard = (
  scope: LeaderboardScope,
  viewer: LeaderboardViewer,
  page: number,
): Promise<LeaderboardPage | null> =>
  readSnapshot(async tx => {
    if (isOpen(await readCurrentYear(tx), scope.year)) {
      return null
    }
    const pages = isPaged(scope) ? await readPages(tx, scope, page) : null
    const rows = await tx.$queryRaw<RankedSubmission[]>`
      SELECT * FROM (${rankedSql(scope)}) AS "Ranked"
      ORDER BY "rank", "playerId"
      ${
        pages
          ? Prisma.sql`
              LIMIT ${LEADERBOARD_PAGE_SIZE}
              OFFSET ${(pages.number - 1) * LEADERBOARD_PAGE_SIZE}
            `
          : Prisma.empty
      }
    `
    return { rows: rows.map(row => toRow(row, scope, viewer)), page: pages }
  })

/** A contest's rows all fit on one page, so it prints whole */
const isPaged = ({ kind }: LeaderboardScope): boolean => kind !== `contest`

/** The page, or the last one for a page past it */
const readPages = async (
  tx: Prisma.TransactionClient,
  scope: LeaderboardScope,
  page: number,
): Promise<{ number: number; count: number }> => {
  const [row] = await tx.$queryRaw<{ total: number }[]>`
    SELECT count(*)::int AS "total" FROM (${rankedSql(scope)}) AS "Ranked"
  `
  const count = Math.max(1, Math.ceil(row!.total / LEADERBOARD_PAGE_SIZE))
  return { number: Math.min(page, count), count }
}

export type LeaderboardSubmission = {
  row: LeaderboardRow
  bracket: StoredBracket
  results: Results
  picks: Picks
}

/**
 * The submission behind a row of the scope's leaderboard. Null when the player
 * has no row, and while the year is open, when no one sees another player's
 * picks
 */
export const readLeaderboardSubmission = (
  scope: LeaderboardScope,
  playerId: string,
  viewer: LeaderboardViewer,
): Promise<LeaderboardSubmission | null> =>
  readSnapshot(async tx => {
    if (isOpen(await readCurrentYear(tx), scope.year)) {
      return null
    }
    const [row] = await tx.$queryRaw<RankedSubmission[]>`
      SELECT * FROM (${rankedSql(scope)}) AS "Ranked"
      WHERE "playerId" = ${playerId}
    `
    return row
      ? {
          row: toRow(row, scope, viewer),
          picks: await readSubmissionPicks(playerId, tx),
          ...(await readBracketAndResultRows(scope.year, tx)),
        }
      : null
  })

/** An approved submission's place, with its name whoever the viewer is */
type RankedSubmission = {
  playerId: string
  displayName: string
  contestId: string
  contestName: string
  educatorId: string
  educatorName: string
  score: number
  rank: number
  /** 1 for the highest score tier in its contest */
  contestTier: number
}

const toRow = (
  row: RankedSubmission,
  scope: LeaderboardScope,
  viewer: LeaderboardViewer,
): LeaderboardRow => {
  const isOwn = viewer.kind === `player` && viewer.playerId === row.playerId
  return {
    playerId: row.playerId,
    label: isNamed(row, viewer) ? row.displayName : describeHidden(row, scope),
    score: row.score,
    rank: row.rank,
    isOwn,
  }
}

const isNamed = (row: RankedSubmission, viewer: LeaderboardViewer): boolean =>
  viewer.kind === `educator`
    ? row.educatorId === viewer.educatorId
    : row.playerId === viewer.playerId ||
      (row.contestId === viewer.contestId && row.contestTier <= NAMED_TIERS)

const describeHidden = (
  { contestName, educatorName }: RankedSubmission,
  scope: LeaderboardScope,
): string => {
  switch (scope.kind) {
    case `contest`:
      return `Player`
    case `organization`:
      return `Player from ${contestName} (${educatorName})`
  }
}

/**
 * Ties rank by when the picks last changed, earliest first, so only identical
 * times share a rank
 */
const rankedSql = (scope: LeaderboardScope): Prisma.Sql => Prisma.sql`
  SELECT
    "Player"."id" AS "playerId",
    "Player"."displayName",
    "Contest"."id" AS "contestId",
    "Contest"."name" AS "contestName",
    "Educator"."id" AS "educatorId",
    "Educator"."name" AS "educatorName",
    "Submission"."score",
    (rank() OVER (
      ORDER BY "Submission"."score" DESC, "Submission"."picksChangedAt"
    ))::int AS "rank",
    (dense_rank() OVER (
      PARTITION BY "Contest"."id" ORDER BY "Submission"."score" DESC
    ))::int AS "contestTier"
  FROM "Submission"
  JOIN "Player" ON "Player"."id" = "Submission"."playerId"
  JOIN "Contest" ON "Contest"."id" = "Player"."contestId"
  JOIN "Educator" ON "Educator"."id" = "Contest"."educatorId"
  WHERE ${scopeSql(scope)}
    AND "Contest"."year" = ${scope.year}
    AND "Player"."deletedAt" IS NULL
    AND "Contest"."deletedAt" IS NULL
    AND "Submission"."status" = 'APPROVED'
`

const scopeSql = (scope: LeaderboardScope): Prisma.Sql => {
  switch (scope.kind) {
    case `contest`:
      return Prisma.sql`"Contest"."id" = ${scope.contestId}`
    case `organization`:
      return Prisma.sql`${CONTEST_ORGANIZATION_SQL} = ${scope.domain}`
  }
}
