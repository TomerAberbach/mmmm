import { listBattles, toBattleId, toBattleKey } from './bracket.ts'
import type { Prisma } from './generated/prisma/client.ts'
import type { Results } from './results.ts'
import { listRightWinners, ROUND_POINTS } from './scoring.ts'
import type { SeededBracket } from './seeded-bracket.ts'

/**
 * Stores the score that the results give each of the year's submissions, in the
 * trash or not. Call it in the transaction that saves the results, alone, since
 * a group's approval or erasure locks its submissions in its own order
 */
export const storeScores = async (
  tx: Prisma.TransactionClient,
  year: number,
  bracket: SeededBracket,
  results: Results,
): Promise<void> => {
  const rightPicks = listBattles().flatMap(battle =>
    listRightWinners(bracket, results, battle).map(winnerId => ({
      battleId: toBattleId(year, toBattleKey(battle)),
      winnerId,
      points: ROUND_POINTS[battle.round],
    })),
  )
  // One statement, because a year can have millions of picks
  await tx.$executeRaw`
    WITH "Scored" AS (
      SELECT "Pick"."playerId", sum("RightPick"."points")::int AS "score"
      FROM unnest(
        ${rightPicks.map(({ battleId }) => battleId)}::text[],
        ${rightPicks.map(({ winnerId }) => winnerId)}::text[],
        ${rightPicks.map(({ points }) => points)}::int[]
      ) AS "RightPick" ("battleId", "winnerId", "points")
      JOIN "Pick"
        ON "Pick"."battleId" = "RightPick"."battleId"
        AND "Pick"."combatantId" = "RightPick"."winnerId"
        AND "Pick"."stage" = 'SUBMISSION'
      GROUP BY "Pick"."playerId"
    )
    UPDATE "Submission"
    SET "score" = coalesce("Scored"."score", 0)
    FROM "Player"
    JOIN "Contest" ON "Contest"."id" = "Player"."contestId"
    LEFT JOIN "Scored" ON "Scored"."playerId" = "Player"."id"
    WHERE "Submission"."playerId" = "Player"."id"
      AND "Contest"."year" = ${year}
      AND "Submission"."score" <> coalesce("Scored"."score", 0)
  `
}
