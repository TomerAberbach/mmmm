import { toBattleKey } from './bracket.ts'
import type { BattleRef } from './bracket.ts'
import { lockYear, readBracketRows } from './brackets.server.ts'
import type { BracketRows } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import type { Prisma, SubmissionStatus } from './generated/prisma/client.ts'
import { arePicksComplete, arePicksConsistent, arePicksEqual } from './picks.ts'
import type { Picks } from './picks.ts'
import { toSeededBracket } from './seeded-bracket.ts'

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
  yearId: number,
  picks: Picks,
): Promise<{ saved: true } | PicksRefusal> =>
  withPlayerBracket(playerId, yearId, async (tx, bracket) => {
    if (!arePicksConsistent(toSeededBracket(bracket.input), picks)) {
      return { refusal: `INCONSISTENT` } as const
    }
    await writePicks(tx, playerId, `DRAFT`, picks, bracket)
    return { saved: true } as const
  })

// Saves the picks as the player's draft and submits them, unless they're
// incomplete. A first submission waits for approval, and a later one keeps the
// submission's status
export const submitPlayerPicks = (
  playerId: string,
  yearId: number,
  picks: Picks,
): Promise<{ submission: Submission } | PicksRefusal> =>
  withPlayerBracket(playerId, yearId, async (tx, bracket) => {
    if (!arePicksComplete(toSeededBracket(bracket.input), picks)) {
      return { refusal: `INCOMPLETE` } as const
    }
    const isChanged = !arePicksEqual(
      await readPicks(tx, playerId, `SUBMISSION`),
      picks,
    )
    await writePicks(tx, playerId, `DRAFT`, picks, bracket)
    if (isChanged) {
      await writePicks(tx, playerId, `SUBMISSION`, picks, bracket)
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
  yearId: number,
): Promise<{ discarded: true } | PicksRefusal> =>
  withCurrentPlayer(playerId, yearId, async tx => {
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
  combatant: { select: { name: true } },
} as const

const readPicks = async (
  tx: Prisma.TransactionClient,
  playerId: string,
  stage: PickStage,
): Promise<Picks> =>
  toPicks(
    await tx.pick.findMany({ where: { playerId, stage }, select: PICK_SELECT }),
  )

const toPicks = (
  picks: { battle: BattleRef; combatant: { name: string } }[],
): Picks =>
  Object.fromEntries(
    picks.map(({ battle, combatant }) => [toBattleKey(battle), combatant.name]),
  )

const writePicks = async (
  tx: Prisma.TransactionClient,
  playerId: string,
  stage: PickStage,
  picks: Picks,
  bracket: BracketRows,
): Promise<void> => {
  await tx.pick.deleteMany({ where: { playerId, stage } })
  await tx.pick.createMany({
    data: Object.entries(picks).map(([key, winner]) => ({
      playerId,
      stage,
      battleId: bracket.battleIdByKey.get(key)!,
      combatantId: bracket.combatantIdByName.get(winner)!,
    })),
  })
}

// Runs `change` in a transaction once it holds the player's row and the year,
// refusing unless the year is current. The player must be in one of the year's
// contests
const withCurrentPlayer = <Result>(
  playerId: string,
  yearId: number,
  change: (tx: Prisma.TransactionClient) => Promise<Result>,
): Promise<Result | PicksRefusal> =>
  prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM "Player" WHERE "id" = ${playerId} FOR UPDATE`
    return (await lockYear(tx, yearId, `SHARE`)) === `CURRENT`
      ? change(tx)
      : ({ refusal: `NOT_CURRENT_YEAR` } as const)
  })

// Runs `change` as `withCurrentPlayer` does, with the year's bracket rows
const withPlayerBracket = <Result>(
  playerId: string,
  yearId: number,
  change: (
    tx: Prisma.TransactionClient,
    bracket: BracketRows,
  ) => Promise<Result>,
): Promise<Result | PicksRefusal> =>
  withCurrentPlayer(playerId, yearId, async tx =>
    // A current year's bracket is published, so it exists
    change(tx, (await readBracketRows(yearId, tx))!),
  )
