import { listBattles, toBattleKey } from './bracket.ts'
import type { Prisma } from './generated/prisma/client.ts'
import type { Results } from './results.ts'
import { listRightWinners, ROUND_POINTS } from './scoring.ts'
import type { SeededBracket } from './seeded-bracket.ts'

/**
 * Stores the score that the results give each of the year's submissions, in the
 * trash or not. Call it in the transaction that saves the results
 */
export const storeScores = async (
  tx: Prisma.TransactionClient,
  year: number,
  bracket: SeededBracket,
  battleIdByKey: ReadonlyMap<string, string>,
  results: Results,
): Promise<void> => {
  const rightPicks = listBattles().flatMap(battle =>
    listRightWinners(bracket, results, battle).map(winnerId => ({
      battleId: battleIdByKey.get(toBattleKey(battle))!,
      winnerId,
      points: ROUND_POINTS[battle.round],
    })),
  )
  // A group's approval or erasure locks its submissions in its own order, so
  // one running alongside the update could deadlock with it
  await tx.$executeRaw`LOCK TABLE "Submission" IN SHARE ROW EXCLUSIVE MODE`
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
