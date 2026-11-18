import { toBattleKey } from './bracket.ts'
import type { BattleRef } from './bracket.ts'
import { lockYear, readBracketRows } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import type { Prisma, SubmissionStatus } from './generated/prisma/client.ts'
import { arePicksComplete, arePicksConsistent, arePicksEqual } from './picks.ts'
import type { Picks } from './picks.ts'
import { toSeededBracket } from './seeded-bracket.ts'
import type { SeededBracket } from './seeded-bracket.ts'

export type Submission = {
  status: SubmissionStatus
  picksChangedAt: Date
  picks: Picks
}

// The player's draft, and their submission once they've submitted
export const readDraftAndSubmission = async (
  playerId: string,
): Promise<{ draft: Picks; submission: Submission | null }> => {
  // One snapshot, so a concurrent submit can't pair one submission with
  // another's picks
  const [picks, submission] = await prisma.$transaction(
    [
      prisma.pick.findMany({ where: { playerId }, select: PICK_SELECT }),
      prisma.submission.findUnique({
        where: { playerId },
        select: { status: true, picksChangedAt: true },
      }),
    ],
    { isolationLevel: `RepeatableRead` },
  )
  const toStagePicks = (stage: PickStage): Picks =>
    toPicks(picks.filter(pick => pick.stage === stage))
  return {
    draft: toStagePicks(`DRAFT`),
    submission: submission && {
      ...submission,
      picks: toStagePicks(`SUBMISSION`),
    },
  }
}

// Only the current year's contests take picks
export type PicksRefusal = {
  refusal: `NOT_CURRENT_YEAR` | `INCONSISTENT` | `INCOMPLETE` | `NOT_SUBMITTED`
}

// Replaces the player's draft, unless the picks aren't consistent with the
// bracket
export const savePlayerDraft = (
  playerId: string,
  year: number,
  picks: Picks,
): Promise<{ saved: true } | PicksRefusal> =>
  withPlayerBracket(playerId, year, async (tx, bracket, battleIdByKey) => {
    if (!arePicksConsistent(bracket, picks)) {
      return { refusal: `INCONSISTENT` } as const
    }
    await writePicks(tx, playerId, `DRAFT`, picks, battleIdByKey)
    return { saved: true } as const
  })

// Saves the picks as the player's draft and submits them, unless they're
// incomplete. A first submission waits for approval, and a later one keeps the
// submission's status
export const submitPlayerPicks = (
  playerId: string,
  year: number,
  picks: Picks,
): Promise<{ submission: Submission } | PicksRefusal> =>
  withPlayerBracket(playerId, year, async (tx, bracket, battleIdByKey) => {
    if (!arePicksComplete(bracket, picks)) {
      return { refusal: `INCOMPLETE` } as const
    }
    const isChanged = !arePicksEqual(
      await readPicks(tx, playerId, `SUBMISSION`),
      picks,
    )
    await writePicks(tx, playerId, `DRAFT`, picks, battleIdByKey)
    if (isChanged) {
      await writePicks(tx, playerId, `SUBMISSION`, picks, battleIdByKey)
    }
    // `create` runs only for a first submission, which always changes the
    // submitted picks
    const picksChangedAt = new Date()
    const submission = await tx.submission.upsert({
      where: { playerId },
      create: { playerId, picksChangedAt },
      update: isChanged ? { picksChangedAt } : {},
      select: { status: true, picksChangedAt: true },
    })
    return { submission: { ...submission, picks } }
  })

// Replaces the player's draft with their submission's picks, unless the player
// hasn't submitted
export const discardPlayerDraft = (
  playerId: string,
  year: number,
): Promise<{ discarded: true } | PicksRefusal> =>
  withCurrentPlayer(playerId, year, async tx => {
    if (!(await tx.submission.findUnique({ where: { playerId } }))) {
      return { refusal: `NOT_SUBMITTED` } as const
    }
    await tx.pick.deleteMany({ where: { playerId, stage: `DRAFT` } })
    await tx.$executeRaw`
      INSERT INTO "Pick" ("playerId", "stage", "battleId", "combatantId")
      SELECT "playerId", 'DRAFT', "battleId", "combatantId" FROM "Pick"
      WHERE "playerId" = ${playerId} AND "stage" = 'SUBMISSION'
    `
    return { discarded: true } as const
  })

type PickStage = `DRAFT` | `SUBMISSION`

const PICK_SELECT = {
  stage: true,
  battle: { select: { round: true, index: true } },
  combatantId: true,
} as const

const readPicks = async (
  tx: Prisma.TransactionClient,
  playerId: string,
  stage: PickStage,
): Promise<Picks> =>
  toPicks(
    await tx.pick.findMany({ where: { playerId, stage }, select: PICK_SELECT }),
  )

const toPicks = (picks: { battle: BattleRef; combatantId: string }[]): Picks =>
  Object.fromEntries(
    picks.map(({ battle, combatantId }) => [toBattleKey(battle), combatantId]),
  )

const writePicks = async (
  tx: Prisma.TransactionClient,
  playerId: string,
  stage: PickStage,
  picks: Picks,
  battleIdByKey: ReadonlyMap<string, string>,
): Promise<void> => {
  await tx.pick.deleteMany({ where: { playerId, stage } })
  await tx.pick.createMany({
    data: Object.entries(picks).map(([key, combatantId]) => ({
      playerId,
      stage,
      battleId: battleIdByKey.get(key)!,
      combatantId,
    })),
  })
}

// Runs `change` in a transaction once it holds the player's row and the year,
// refusing unless the year is current. The player must be in one of the year's
// contests
const withCurrentPlayer = <Result>(
  playerId: string,
  year: number,
  change: (tx: Prisma.TransactionClient) => Promise<Result>,
): Promise<Result | PicksRefusal> =>
  prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM "Player" WHERE "id" = ${playerId} FOR UPDATE`
    return (await lockYear(tx, year, `SHARE`)) === `CURRENT`
      ? change(tx)
      : ({ refusal: `NOT_CURRENT_YEAR` } as const)
  })

// Runs `change` as `withCurrentPlayer` does, with the year's bracket and its
// battles' row IDs, keyed by `toBattleKey`
const withPlayerBracket = <Result>(
  playerId: string,
  year: number,
  change: (
    tx: Prisma.TransactionClient,
    bracket: SeededBracket,
    battleIdByKey: ReadonlyMap<string, string>,
  ) => Promise<Result>,
): Promise<Result | PicksRefusal> =>
  withCurrentPlayer(playerId, year, async tx => {
    // A current year's bracket is published, so it exists
    const { bracket, battleIdByKey } = (await readBracketRows(year, tx))!
    return change(tx, toSeededBracket(bracket), battleIdByKey)
  })
