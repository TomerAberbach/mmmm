import { toBattleKey } from './bracket.ts'
import type { BattleRef } from './bracket.ts'
import { readBracketRows } from './brackets.server.ts'
import type { BracketRows } from './brackets.server.ts'
import { prisma } from './db.server.ts'
import type { Prisma, SubmissionStatus } from './generated/prisma/client.ts'
import {
  arePicksComplete,
  arePicksConsistent,
  arePicksEqual,
  toPickBracket,
} from './picks.ts'
import type { Picks } from './picks.ts'

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

// Replaces the player's draft. Resolves to false and changes nothing when the
// picks aren't consistent with the bracket
export const savePlayerDraft = async (
  playerId: string,
  yearId: number,
  picks: Picks,
): Promise<boolean> => {
  const bracket = await readBracketRows(yearId)
  if (!bracket || !arePicksConsistent(toPickBracket(bracket.input), picks)) {
    return false
  }
  await prisma.$transaction(async tx => {
    await lockPlayerRow(tx, playerId)
    await writePicks(tx, playerId, `DRAFT`, picks, bracket)
  })
  return true
}

// Saves the picks as the player's draft and submits them. A first submission
// waits for approval, and a later one keeps the submission's status. Resolves
// to null and changes nothing unless the picks are complete
export const submitPlayerPicks = async (
  playerId: string,
  yearId: number,
  picks: Picks,
): Promise<Submission | null> => {
  const bracket = await readBracketRows(yearId)
  if (!bracket || !arePicksComplete(toPickBracket(bracket.input), picks)) {
    return null
  }
  return prisma.$transaction(async tx => {
    await lockPlayerRow(tx, playerId)
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
    return { ...submission, picks }
  })
}

// Replaces the player's draft with their submission's picks. Resolves to false
// and changes nothing when the player hasn't submitted
export const discardPlayerDraft = (playerId: string): Promise<boolean> =>
  prisma.$transaction(async tx => {
    await lockPlayerRow(tx, playerId)
    if (!(await tx.submission.findUnique({ where: { playerId } }))) {
      return false
    }
    await tx.pick.deleteMany({ where: { playerId, stage: `DRAFT` } })
    await tx.$executeRaw`
      INSERT INTO "Pick" ("playerId", "stage", "battleId", "combatantId")
      SELECT "playerId", 'DRAFT', "battleId", "combatantId" FROM "Pick"
      WHERE "playerId" = ${playerId} AND "stage" = 'SUBMISSION'
    `
    return true
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

// Makes a concurrent change to the player's picks wait for this transaction,
// so the two can't interleave their deletes and inserts
const lockPlayerRow = async (
  tx: Prisma.TransactionClient,
  playerId: string,
): Promise<void> => {
  await tx.$queryRaw`SELECT 1 FROM "Player" WHERE "id" = ${playerId} FOR UPDATE`
}
