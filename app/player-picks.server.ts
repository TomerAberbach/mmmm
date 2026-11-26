import { toBattleKey } from './bracket.ts'
import type { BattleRef } from './bracket.ts'
import {
  isOpen,
  readBracketAndResultRows,
  readBracketRows,
  readSnapshot,
  withCurrentYear,
} from './brackets.server.ts'
import { prisma } from './db.server.ts'
import type {
  PickStage,
  Prisma,
  SubmissionStatus,
} from './generated/prisma/client.ts'
import { lockPlayers } from './lock-players.server.ts'
import { readArrangement } from './moves.ts'
import { PLAYER_OUTSIDE_TRASH } from './outside-trash.server.ts'
import { arePicksComplete, arePicksConsistent, arePicksEqual } from './picks.ts'
import type { Picks } from './picks.ts'
import type { Results } from './results.ts'
import { toSeededBracket } from './seeded-bracket.ts'
import type { SeededBracket, StoredBracket } from './seeded-bracket.ts'

export type Submission = {
  status: SubmissionStatus
  picksChangedAt: Date
  picks: Picks
}

type DraftAndSubmission = {
  draft: Picks
  submission: Submission | null
  /** Whether a move of combatants cleared picks since the player submitted */
  hasClearedPicks: boolean
}

/** The player's draft, and their submission once they've submitted */
export const readDraftAndSubmission = (
  playerId: string,
): Promise<DraftAndSubmission> =>
  // One snapshot, so a concurrent submit can't pair one submission with
  // another's picks
  readSnapshot(tx => readDraftAndSubmissionRows(playerId, tx))

/**
 * The player's picks with the bracket and results of their year, which must
 * have a bracket. One snapshot, so a concurrent move can't pair one
 * arrangement with another's picks
 */
export const readPlayerBracket = (
  playerId: string,
  year: number,
): Promise<DraftAndSubmission & { bracket: StoredBracket; results: Results }> =>
  readSnapshot(async tx => ({
    ...(await readBracketAndResultRows(year, tx)),
    ...(await readDraftAndSubmissionRows(playerId, tx)),
  }))

/** Null until the player submits */
export const readSubmissionStatus = async (
  playerId: string,
): Promise<SubmissionStatus | null> =>
  (
    await prisma.submission.findUnique({
      where: { playerId },
      select: { status: true },
    })
  )?.status ?? null

const readDraftAndSubmissionRows = async (
  playerId: string,
  tx: Prisma.TransactionClient,
): Promise<DraftAndSubmission> => {
  const picks = await tx.pick.findMany({
    where: { playerId },
    select: PICK_SELECT,
  })
  const submission = await tx.submission.findUnique({
    where: { playerId },
    select: { status: true, picksChangedAt: true },
  })
  const player = await tx.player.findUnique({
    where: { id: playerId },
    select: { picksClearedAt: true },
  })
  const toStagePicks = (stage: PickStage): Picks =>
    toPicks(picks.filter(pick => pick.stage === stage))
  return {
    draft: toStagePicks(`DRAFT`),
    submission: submission && {
      ...submission,
      picks: toStagePicks(`SUBMISSION`),
    },
    hasClearedPicks: Boolean(player?.picksClearedAt),
  }
}

/** Only an open year's contests take picks */
export type PicksRefusal = {
  refusal:
    | `NOT_OPEN`
    | `DELETED`
    | `MOVED`
    | `INCONSISTENT`
    | `INCOMPLETE`
    | `NOT_SUBMITTED`
}

/**
 * Replaces the player's draft, unless the picks aren't consistent with the
 * bracket, or were made of another arrangement of it than `arrangement`
 */
export const savePlayerDraft = (
  playerId: string,
  picks: Picks,
  arrangement?: string,
): Promise<{ saved: true } | PicksRefusal> =>
  withPlayerBracket(
    playerId,
    arrangement,
    async (tx, bracket, battleIdByKey) => {
      if (!arePicksConsistent(bracket, picks)) {
        return { refusal: `INCONSISTENT` } as const
      }
      await writePicks(tx, playerId, `DRAFT`, picks, battleIdByKey)
      return { saved: true } as const
    },
  )

/**
 * Saves the picks as the player's draft and submits them, unless they're
 * incomplete, or were made of another arrangement than `arrangement`. A first
 * submission waits for approval, and a later one keeps the submission's status
 */
export const submitPlayerPicks = (
  playerId: string,
  picks: Picks,
  arrangement?: string,
): Promise<{ submission: Submission } | PicksRefusal> =>
  withPlayerBracket(
    playerId,
    arrangement,
    async (tx, bracket, battleIdByKey) => {
      if (!arePicksComplete(bracket, picks)) {
        return { refusal: `INCOMPLETE` } as const
      }
      const isChanged = !arePicksEqual(
        await readSubmissionPicks(playerId, tx),
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
      await tx.player.update({
        where: { id: playerId },
        data: { picksClearedAt: null },
      })
      return { submission: { ...submission, picks } }
    },
  )

/**
 * Replaces the player's draft with their submission's picks, unless the player
 * hasn't submitted
 */
export const discardPlayerDraft = (
  playerId: string,
): Promise<{ discarded: true } | PicksRefusal> =>
  withCurrentPlayer(playerId, async tx => {
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

/**
 * Clears every pick of the battles in the year's contests. Before the lock, a
 * submission that loses picks returns to a draft. Players who lose picks see a
 * note until they submit
 */
export const clearPicks = async (
  tx: Prisma.TransactionClient,
  year: number,
  battleIds: string[],
  isLocked: boolean,
): Promise<void> => {
  await lockPlayers(tx)
  const contest = { year }
  const battleId = { in: battleIds }
  await tx.player.updateMany({
    where: { contest, picks: { some: { battleId } } },
    data: { picksClearedAt: new Date() },
  })
  if (!isLocked) {
    await deleteClearedSubmissions(tx, year)
  }
  await tx.pick.deleteMany({ where: { battleId } })
}

/** Returns each of the year's submissions that lost picks to a draft */
export const returnClearedSubmissions = async (
  tx: Prisma.TransactionClient,
  year: number,
): Promise<void> => {
  await lockPlayers(tx)
  await deleteClearedSubmissions(tx, year)
}

const deleteClearedSubmissions = async (
  tx: Prisma.TransactionClient,
  year: number,
): Promise<void> => {
  const contest = { year }
  await tx.submission.deleteMany({
    where: { player: { contest, picksClearedAt: { not: null } } },
  })
  await tx.pick.deleteMany({
    where: { stage: `SUBMISSION`, player: { contest, submission: null } },
  })
}

const PICK_SELECT = {
  stage: true,
  battle: { select: { round: true, index: true } },
  combatantId: true,
} as const

export const readSubmissionPicks = async (
  playerId: string,
  tx: Prisma.TransactionClient,
): Promise<Picks> =>
  toPicks(
    await tx.pick.findMany({
      where: { playerId, stage: `SUBMISSION` },
      select: PICK_SELECT,
    }),
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

/**
 * Runs `change` in a transaction once it holds the years and the player's row,
 * with the player's year, refusing unless that year is open and the player
 * and their contest are outside the trash
 */
const withCurrentPlayer = <Result>(
  playerId: string,
  change: (tx: Prisma.TransactionClient, year: number) => Promise<Result>,
): Promise<Result | PicksRefusal> =>
  withCurrentYear(async (tx, current) => {
    await tx.$queryRaw`SELECT 1 FROM "Player" WHERE "id" = ${playerId} FOR UPDATE`
    // The request may have read the player before another deleted them or
    // their contest
    const player = await tx.player.findFirst({
      where: { id: playerId, ...PLAYER_OUTSIDE_TRASH },
      select: { contest: { select: { year: true } } },
    })
    if (!player) {
      return { refusal: `DELETED` } as const
    }
    const { year } = player.contest
    return isOpen(current, year)
      ? change(tx, year)
      : ({ refusal: `NOT_OPEN` } as const)
  })

/**
 * Runs `change` as `withCurrentPlayer` does, with the year's bracket and its
 * battles' row IDs, keyed by `toBattleKey`
 */
const withPlayerBracket = <Result>(
  playerId: string,
  arrangement: string | undefined,
  change: (
    tx: Prisma.TransactionClient,
    bracket: SeededBracket,
    battleIdByKey: ReadonlyMap<string, string>,
  ) => Promise<Result>,
): Promise<Result | PicksRefusal> =>
  withCurrentPlayer(playerId, async (tx, year) => {
    const { bracket, battleIdByKey } = await readBracketRows(year, tx)
    return arrangement !== undefined && arrangement !== readArrangement(bracket)
      ? ({ refusal: `MOVED` } as const)
      : change(tx, toSeededBracket(bracket), battleIdByKey)
  })
