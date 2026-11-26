import {
  isOpen,
  isOpenYear,
  readBracketAndResultRows,
  readCurrentYear,
  readSnapshot,
} from './brackets.server.ts'
import { prisma } from './db.server.ts'
import { Prisma } from './generated/prisma/client.ts'
import { UNNAMED_PLAYER } from './leaderboard-row.ts'
import type {
  LeaderboardPage,
  LeaderboardRow,
  PlayerRank,
} from './leaderboard-row.ts'
import { CONTEST_ORGANIZATION_SQL } from './organizations.server.ts'
import { countRowsBefore, PAGE_SIZE, toPageNumber } from './page-number.ts'
import type { Picks } from './picks.ts'
import { readSubmissionPicks } from './player-picks.server.ts'
import type { Results } from './results.ts'
import type { StoredBracket } from './seeded-bracket.ts'
import { readSharedContestIds } from './shares.server.ts'

/** Whose approved submissions a leaderboard ranks, in one year */
export type LeaderboardScope = { year: number } & (
  | { kind: `contest`; contestId: string }
  | { kind: `organization`; domain: string }
  | { kind: `global` }
)

/**
 * An educator sees every name in their own contests and those shared with them.
 * A player sees their own name and the top score tiers' in their own contest. No
 * other name leaves its contest
 */
export type LeaderboardViewer =
  | { kind: `educator`; educatorId: string }
  | { kind: `player`; contestId: string; playerId: string }

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
    const pages = isPaged(scope)
      ? toPageNumber(page, await countRanked(tx, scope))
      : null
    const rows = await tx.$queryRaw<RankedSubmission[]>(
      withNamesSql(Prisma.sql`
        SELECT * FROM (${rankedSql(scope)}) AS "Ranked"
        ORDER BY "rank", "playerId"
        ${
          pages
            ? Prisma.sql`LIMIT ${PAGE_SIZE} OFFSET ${countRowsBefore(pages)}`
            : Prisma.empty
        }
      `),
    )
    return { rows: rows.map(await labelRows(tx, scope, viewer)), page: pages }
  })

/** A contest's rows all fit on one page, so it prints whole */
const isPaged = ({ kind }: LeaderboardScope): boolean => kind !== `contest`

const countRanked = async (
  tx: Prisma.TransactionClient,
  scope: LeaderboardScope,
): Promise<number> => {
  const [row] = await tx.$queryRaw<{ total: number }[]>`
    SELECT count(*)::int AS "total"
    ${APPROVED_SUBMISSIONS_SQL} AND ${scopeSql(scope)}
  `
  return row!.total
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
    const [row] = await tx.$queryRaw<RankedSubmission[]>(
      withNamesSql(Prisma.sql`
        SELECT * FROM (${rankedSql(scope)}) AS "Ranked"
        WHERE "playerId" = ${playerId}
      `),
    )
    return row
      ? {
          row: (await labelRows(tx, scope, viewer))(row),
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
  organizationName: string | null
  score: number
  rank: number
  /** 1 for the highest score tier in its contest */
  contestTier: number
}

/** Resolves to what labels a row as the viewer sees it */
const labelRows = async (
  tx: Prisma.TransactionClient,
  scope: LeaderboardScope,
  viewer: LeaderboardViewer,
): Promise<(row: RankedSubmission) => LeaderboardRow> => {
  const isNamed = await readNamed(tx, scope.year, viewer)
  return row => ({
    playerId: row.playerId,
    label: isNamed(row) ? row.displayName : describeHidden(row, scope),
    score: row.score,
    rank: row.rank,
    isOwn: viewer.kind === `player` && viewer.playerId === row.playerId,
  })
}

/** Resolves to whether the viewer sees a row's name */
const readNamed = async (
  tx: Prisma.TransactionClient,
  year: number,
  viewer: LeaderboardViewer,
): Promise<(row: RankedSubmission) => boolean> => {
  if (viewer.kind === `player`) {
    return row =>
      row.playerId === viewer.playerId ||
      (row.contestId === viewer.contestId && row.contestTier <= NAMED_TIERS)
  }
  const { educatorId } = viewer
  const sharedIds = await readSharedContestIds(educatorId, year, tx)
  return row => row.educatorId === educatorId || sharedIds.has(row.contestId)
}

const describeHidden = (
  { contestName, educatorName, organizationName }: RankedSubmission,
  scope: LeaderboardScope,
): string => {
  switch (scope.kind) {
    case `contest`:
      return UNNAMED_PLAYER
    case `organization`:
      return `Player from ${contestName} (${educatorName})`
    case `global`:
      return organizationName === null
        ? UNNAMED_PLAYER
        : `Player from ${organizationName}`
  }
}

/** Looks up the names of only the ranked rows, so ranking sorts short rows */
const withNamesSql = (ranked: Prisma.Sql): Prisma.Sql => Prisma.sql`
  SELECT
    "Ranked".*,
    "Player"."displayName",
    "Contest"."name" AS "contestName",
    "Educator"."id" AS "educatorId",
    "Educator"."name" AS "educatorName",
    "Organization"."name" AS "organizationName"
  FROM (${ranked}) AS "Ranked"
  JOIN "Player" ON "Player"."id" = "Ranked"."playerId"
  JOIN "Contest" ON "Contest"."id" = "Ranked"."contestId"
  JOIN "Educator" ON "Educator"."id" = "Contest"."educatorId"
  LEFT JOIN "Organization" ON "Organization"."domain" = ${CONTEST_ORGANIZATION_SQL}
  ORDER BY "rank", "playerId"
`

/**
 * Ties rank by when the picks last changed, earliest first, so only identical
 * times share a rank
 */
const rankedSql = (scope: LeaderboardScope): Prisma.Sql => Prisma.sql`
  SELECT
    "Player"."id" AS "playerId",
    "Contest"."id" AS "contestId",
    "Submission"."score",
    (rank() OVER (
      ORDER BY "Submission"."score" DESC, "Submission"."picksChangedAt"
    ))::int AS "rank",
    (dense_rank() OVER (
      PARTITION BY "Contest"."id" ORDER BY "Submission"."score" DESC
    ))::int AS "contestTier"
  ${APPROVED_SUBMISSIONS_SQL} AND ${scopeSql(scope)}
`

/** Every year's approved submissions outside the trash */
const APPROVED_SUBMISSIONS_SQL = Prisma.sql`
  FROM "Submission"
  JOIN "Player" ON "Player"."id" = "Submission"."playerId"
  JOIN "Contest" ON "Contest"."id" = "Player"."contestId"
  JOIN "Educator" ON "Educator"."id" = "Contest"."educatorId"
  WHERE "Player"."deletedAt" IS NULL
    AND "Contest"."deletedAt" IS NULL
    AND "Submission"."status" = 'APPROVED'
`

const scopeSql = (scope: LeaderboardScope): Prisma.Sql =>
  Prisma.sql`"Contest"."year" = ${scope.year} AND ${membershipSql(scope)}`

const membershipSql = (scope: LeaderboardScope): Prisma.Sql => {
  switch (scope.kind) {
    case `contest`:
      return Prisma.sql`"Contest"."id" = ${scope.contestId}`
    case `organization`:
      return Prisma.sql`
        NOT "Contest"."isHidden" AND ${CONTEST_ORGANIZATION_SQL} = ${scope.domain}
      `
    case `global`:
      return Prisma.sql`NOT "Contest"."isHidden" AND "Educator"."emailVerified"`
  }
}

/**
 * Where the player ranks on the scope's leaderboard, in `rankedSql`'s order but
 * without its sort. Null when it leaves the player out, and while the year is
 * open
 */
export const readPlayerRank = async (
  scope: LeaderboardScope,
  playerId: string,
): Promise<PlayerRank | null> => {
  if (await isOpenYear(scope.year)) {
    return null
  }
  // One statement, so a concurrent result can't rank an old score among new ones
  const [row] = await prisma.$queryRaw<(PlayerRank & { isRanked: boolean })[]>`
    WITH "Own" AS (
      SELECT "score", "picksChangedAt" FROM "Submission"
      WHERE "playerId" = ${playerId}
    )
    SELECT
      count(*)::int AS "total",
      (1 + count(*) FILTER (
        WHERE "Submission"."score" > (SELECT "score" FROM "Own")
          OR ("Submission"."score" = (SELECT "score" FROM "Own")
            AND "Submission"."picksChangedAt" <
              (SELECT "picksChangedAt" FROM "Own"))
      ))::int AS "rank",
      coalesce(bool_or("Player"."id" = ${playerId}), false) AS "isRanked"
    ${APPROVED_SUBMISSIONS_SQL} AND ${scopeSql(scope)}
  `
  const { isRanked, ...playerRank } = row!
  return isRanked ? playerRank : null
}

/** The player's contest. Null when `readPlayerRank` would be */
export const readRankedContestId = async (
  scope: LeaderboardScope,
  playerId: string,
): Promise<string | null> => {
  if (await isOpenYear(scope.year)) {
    return null
  }
  const [row] = await prisma.$queryRaw<{ contestId: string }[]>`
    SELECT "Contest"."id" AS "contestId"
    ${APPROVED_SUBMISSIONS_SQL} AND ${scopeSql(scope)}
      AND "Player"."id" = ${playerId}
  `
  return row?.contestId ?? null
}
