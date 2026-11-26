import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { eraseArchivedYear } from './archive.server.ts'
import {
  bracketInputSchema,
  describeTakenName,
  isSameName,
  listDivisionSeedSlots,
  listSeedSlots,
  toBracketSchema,
} from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'
import {
  DIVISION_POSITIONS,
  listBattles,
  mapDivisions,
  toBattleId,
  toBattleKey,
} from './bracket.ts'
import type { BattleRef, DivisionPosition } from './bracket.ts'
import { prisma } from './db.server.ts'
import type { Prisma } from './generated/prisma/client.ts'
import type { Results } from './results.ts'
import type { Combatant, StoredBracket } from './seeded-bracket.ts'
import { readUpcomingYear } from './year.ts'
import {
  CURRENT_BRACKET,
  LOCKED_YEARS_LIMITS,
  lockYearForSaving,
  lockYears,
  readCurrentYear,
  withCurrentYear,
  withCurrentYearAlone,
} from './years.server.ts'

/**
 * Replaces the year's unpublished bracket, keeping its expected lock date, or
 * stores a new one with every seed slot and battle. Returns false and changes
 * nothing when the year's bracket is published. Throws on input
 * `bracketInputSchema` rejects. Takes `lockYears` in `SHARE` mode, so
 * publishing waits for it, and a lock on the year, so concurrent saves of the
 * year run one at a time
 */
export const saveUnpublishedBracket = async (
  year: number,
  input: BracketInput,
): Promise<boolean> => {
  const rows = buildBracketRows(year, bracketInputSchema.parse(input))
  return prisma.$transaction(async tx => {
    await lockYears(tx, `SHARE`)
    await lockYearForSaving(tx, year)
    const existing = await tx.bracket.findUnique({
      where: { year },
      select: { publishedAt: true, expectedLockDate: true },
    })
    if (existing?.publishedAt) {
      return false
    }
    await tx.bracket.deleteMany({ where: { year, publishedAt: null } })
    await insertBracketRows(tx, year, rows, existing?.expectedLockDate ?? null)
    return true
  }, LOCKED_YEARS_LIMITS)
}

/** Inserts an unpublished bracket for a year without one */
export const insertBracket = (
  tx: Prisma.TransactionClient,
  year: number,
  input: BracketInput,
): Promise<void> =>
  insertBracketRows(tx, year, buildBracketRows(year, input), null)

const insertBracketRows = async (
  tx: Prisma.TransactionClient,
  year: number,
  rows: ReturnType<typeof buildBracketRows>,
  expectedLockDate: Date | null,
): Promise<void> => {
  await tx.bracket.create({
    data: {
      year,
      expectedLockDate,
      battles: { createMany: { data: rows.battles } },
    },
  })
  await tx.combatant.createMany({ data: rows.combatants })
  await tx.division.createMany({ data: rows.divisions })
  await tx.seedSlot.createMany({ data: rows.seedSlots })
  await tx.wildCard.create({ data: rows.wildCard })
  await tx.wildCardEntrant.createMany({ data: rows.wildCardEntrants })
}

/** Returns whether the year had an unpublished bracket to delete */
export const deleteUnpublishedBracket = async (
  year: number,
): Promise<boolean> => {
  const { count } = await prisma.bracket.deleteMany({
    where: { year, publishedAt: null },
  })
  return count > 0
}

/**
 * Every row of the year's bracket, linked by IDs made here, so each table
 * takes one insert
 */
const buildBracketRows = (year: number, input: BracketInput) => {
  const combatants: { id: string; year: number; name: string }[] = []
  const addCombatant = (name: string): string => {
    const id = randomUUID()
    combatants.push({ id, year, name })
    return id
  }
  const wildCardSlotId = randomUUID()

  const divisionIds = mapDivisions(() => randomUUID())
  const seedSlots = listSeedSlots(input).map(({ position, seed, combatant }) =>
    combatant === undefined
      ? {
          id: wildCardSlotId,
          divisionId: divisionIds[position],
          seed,
          combatantId: null,
        }
      : {
          id: randomUUID(),
          divisionId: divisionIds[position],
          seed,
          combatantId: addCombatant(combatant),
        },
  )

  const wildCardId = randomUUID()
  return {
    battles: listBattles().map(battle => ({
      id: toBattleId(year, toBattleKey(battle)),
      ...battle,
    })),
    divisions: DIVISION_POSITIONS.map(position => ({
      id: divisionIds[position],
      year,
      position,
      name: input.divisions[position].name,
    })),
    seedSlots,
    wildCard: { id: wildCardId, year, seedSlotId: wildCardSlotId },
    wildCardEntrants: input.wildCard.entrants.map((name, index) => ({
      wildCardId,
      index,
      combatantId: addCombatant(name),
    })),
    combatants,
  }
}

/** Null before any bracket is published */
export const readCurrentBracket = async (): Promise<{
  year: number
  bracket: StoredBracket
  /** Null once the year locks, as without a date */
  expectedLockDate: Date | null
  results: Results
} | null> =>
  readSnapshot(async tx => {
    const current = await tx.bracket.findFirst({
      ...CURRENT_BRACKET,
      select: { year: true, expectedLockDate: true, lockedAt: true },
    })
    return (
      current && {
        year: current.year,
        bracket: await readBracketRows(current.year, tx),
        expectedLockDate: current.lockedAt ? null : current.expectedLockDate,
        results: await readResultRows(current.year, tx),
      }
    )
  })

/** The year must have a bracket */
export const readBracketAndResults = (
  year: number,
): Promise<{ bracket: StoredBracket; results: Results }> =>
  readSnapshot(tx => readBracketAndResultRows(year, tx))

/** Reads in a transaction from `readSnapshot`. The year must have a bracket */
export const readBracketAndResultRows = async (
  year: number,
  tx: Prisma.TransactionClient,
): Promise<{ bracket: StoredBracket; results: Results }> => ({
  bracket: await readBracketRows(year, tx),
  results: await readResultRows(year, tx),
})

/**
 * Every query of `read` sees the database at one moment, so each result's
 * winner is in the bracket even when a merge is saved or cleared between them
 */
export const readSnapshot = <Read>(
  read: (tx: Prisma.TransactionClient) => Promise<Read>,
): Promise<Read> =>
  prisma.$transaction(read, {
    isolationLevel: `RepeatableRead`,
    maxWait: LOCKED_YEARS_LIMITS.maxWait,
  })

/** The year's bracket, published or not, or null when it has none */
export const readBracket = (year: number): Promise<StoredBracket | null> =>
  readSnapshot(async tx =>
    (await tx.bracket.findUnique({ where: { year }, select: { year: true } }))
      ? readBracketRows(year, tx)
      : null,
  )

/** The year's results, keyed by `toBattleKey` */
export const readResultRows = async (
  year: number,
  db: Prisma.TransactionClient = prisma,
): Promise<Results> =>
  toResults(
    await db.battle.findMany({
      ...RESULTS,
      where: { ...RESULTS.where, year },
    }),
  )

const toResults = (
  battles: (BattleRef & { result: { winnerId: string } | null })[],
): Results =>
  Object.fromEntries(
    battles.flatMap(({ result, ...battle }) =>
      result ? [[toBattleKey(battle), result.winnerId]] : [],
    ),
  )

/**
 * Reads the year's bracket in a transaction. The year must have a bracket. One
 * relation a query, because Prisma loads sibling relations at once, and a
 * transaction's connection runs one query at a time
 */
export const readBracketRows = async (
  year: number,
  tx: Prisma.TransactionClient,
): Promise<StoredBracket> => {
  const divisions = await tx.division.findMany({
    where: { year },
    select: {
      position: true,
      name: true,
      seedSlots: {
        orderBy: { seed: `asc` },
        select: { combatant: { select: { id: true, name: true } } },
      },
    },
  })
  const wildCard = await tx.wildCard.findUnique({
    where: { year },
    select: {
      seedSlot: {
        select: { seed: true, division: { select: { position: true } } },
      },
    },
  })
  const entrants = await tx.wildCardEntrant.findMany({
    where: { wildCard: { year } },
    orderBy: { index: `asc` },
    select: { combatant: { select: { id: true, name: true } } },
  })
  const merges = await tx.combatant.findMany({
    where: { year, members: { some: {} } },
    // A fixed order, since a rename would otherwise move its row
    orderBy: { id: `asc` },
    select: {
      id: true,
      name: true,
      members: { orderBy: { id: `asc` }, select: { id: true } },
    },
  })
  return {
    // Parsing checks the stored rows form a whole bracket, and narrows seeds
    ...storedBracketSchema.parse({
      divisions: Object.fromEntries(
        divisions.map(({ position, name, seedSlots }) => [
          position,
          {
            name,
            // The wild card's slot holds no combatant, as the bracket skips it
            combatants: seedSlots.flatMap(({ combatant }) => combatant ?? []),
          },
        ]),
      ),
      wildCard: wildCard && {
        position: wildCard.seedSlot.division.position,
        seed: wildCard.seedSlot.seed,
        entrants: entrants.map(({ combatant }) => combatant),
      },
    }),
    merges: merges.map(({ members, ...merge }) => ({
      ...merge,
      memberIds: members.map(({ id }) => id),
    })),
  }
}

const storedBracketSchema = toBracketSchema(
  z.object({ id: z.string(), name: z.string() }),
)

export type Phase = `SETUP` | `OPEN` | `IN_PROGRESS` | `COMPLETE` | `ARCHIVED`

export type BracketSummary =
  | { phase: `SETUP`; expectedLockDate: Date | null }
  | {
      phase: `OPEN`
      publishedAt: Date
      expectedLockDate: Date | null
      /** Unpublishing stops once the year has a contest */
      hasContests: boolean
    }
  // Submissions reopen only while no results are saved
  | { phase: `IN_PROGRESS`; hasResults: boolean }
  | { phase: `COMPLETE`; champion: string }
  | { phase: `ARCHIVED` }

/** Null when the year has no bracket */
export const readBracketSummary = async (
  year: number,
  db: Prisma.TransactionClient = prisma,
): Promise<BracketSummary | null> => {
  const bracket = await db.bracket.findUnique({
    where: { year },
    select: {
      publishedAt: true,
      expectedLockDate: true,
      lockedAt: true,
      battles: {
        where: { result: { isNot: null } },
        select: {
          round: true,
          result: { select: { winner: { select: { name: true } } } },
        },
      },
      _count: { select: { contests: true } },
    },
  })
  if (!bracket) {
    return null
  }
  const { publishedAt, expectedLockDate, lockedAt, battles, _count } = bracket
  if (!publishedAt) {
    return { phase: `SETUP`, expectedLockDate }
  }
  if ((await readCurrentYear(db))?.year !== year) {
    return { phase: `ARCHIVED` }
  }
  const champion = battles.find(({ round }) => round === `CHAMPIONSHIP`)?.result
    ?.winner.name
  if (champion !== undefined) {
    return { phase: `COMPLETE`, champion }
  }
  return lockedAt
    ? { phase: `IN_PROGRESS`, hasResults: battles.length > 0 }
    : {
        phase: `OPEN`,
        publishedAt,
        hasContests: _count.contests > 0,
        expectedLockDate,
      }
}

/**
 * The years the admin manages: the current year, and the year to set up, which
 * opens once the current year is Complete
 */
export const readAdminYears = async (): Promise<{
  current: { year: number; summary: BracketSummary } | null
  setupYear: number | null
}> => {
  const current = await readCurrentYear()
  const upcomingYear = readUpcomingYear(new Date())
  if (!current) {
    return { current: null, setupYear: upcomingYear }
  }
  const { year } = current
  const summary = (await readBracketSummary(year))!
  return {
    current: { year, summary },
    // The champion can come before April, when the calendar's upcoming year is
    // still this one
    setupYear:
      summary.phase === `COMPLETE` ? Math.max(year + 1, upcomingYear) : null,
  }
}

export type PublicationChange =
  `CHANGED` | `UNCHANGED` | `PAST` | `HAS_CONTESTS` | `LOCKED` | `NO_CHAMPION`

/**
 * Publishing moves the year from Setup to Open, and unpublishing moves it back
 * until the year has a contest or locks. Publishing a newer year erases the
 * current year's trash and unsubmitted drafts. A newer year waits for the current
 * year's champion, since publishing it archives the current year's results.
 * `PAST` means a newer year is current. `UNCHANGED` means the year has no
 * bracket, or its bracket is already in that state
 */
export const setBracketPublished = (
  year: number,
  published: boolean,
): Promise<PublicationChange> =>
  withCurrentYearAlone(async (tx, current) => {
    if (current && year < current.year) {
      return `PAST`
    }
    if (
      !published &&
      (await tx.contest.findFirst({ where: { year }, select: { id: true } }))
    ) {
      return `HAS_CONTESTS`
    }
    if (!published && current?.year === year && current.isLocked) {
      return `LOCKED`
    }
    if (
      published &&
      current &&
      current.year !== year &&
      (await readBracketSummary(current.year, tx))?.phase !== `COMPLETE`
    ) {
      return `NO_CHAMPION`
    }
    const { count } = await tx.bracket.updateMany({
      where: { year, publishedAt: published ? null : { not: null } },
      data: { publishedAt: published ? new Date() : null },
    })
    if (count === 0) {
      return `UNCHANGED`
    }
    if (published && current) {
      await eraseArchivedYear(tx, current.year)
    }
    return `CHANGED`
  })

/**
 * Returns whether the year has a bracket that isn't locked. Null clears the date
 */
export const setExpectedLockDate = (
  year: number,
  expectedLockDate: Date | null,
): Promise<boolean> =>
  withCurrentYear(async tx => {
    // A save of the bracket reinserts the date it read
    await lockYearForSaving(tx, year)
    const { count } = await tx.bracket.updateMany({
      where: { year, lockedAt: null },
      data: { expectedLockDate },
    })
    return count > 0
  })

/**
 * Puts each combatant in its place in `after`, which has the same combatants as
 * `before`, the year's bracket
 */
export const replacePlaces = async (
  tx: Prisma.TransactionClient,
  year: number,
  before: StoredBracket,
  after: StoredBracket,
): Promise<void> => {
  const slotsBefore = listSeedSlots(before)
  const changedSlots = listSeedSlots(after).flatMap(
    ({ position, seed, combatant }, index) =>
      combatant && combatant.id !== slotsBefore[index]!.combatant?.id
        ? {
            where: { seed, division: { year, position } },
            combatantId: combatant.id,
          }
        : [],
  )
  // A combatant has one place, so each leaves its old one first
  await tx.seedSlot.updateMany({
    where: { OR: changedSlots.map(({ where }) => where) },
    data: { combatantId: null },
  })
  const { id: wildCardId } = await tx.wildCard.findUniqueOrThrow({
    where: { year },
    select: { id: true },
  })
  await tx.wildCardEntrant.deleteMany({ where: { wildCardId } })
  await tx.wildCardEntrant.createMany({
    data: after.wildCard.entrants.map(({ id }, index) => ({
      wildCardId,
      index,
      combatantId: id,
    })),
  })
  for (const { where, combatantId } of changedSlots) {
    await tx.seedSlot.updateMany({ where, data: { combatantId } })
  }
}

export type CombatantRow = Combatant & { isWildCardEntrant: boolean }

/**
 * Each division's combatants in seed order, with the wild card's entrants at
 * its seed
 */
export const listBracketCombatants = (
  bracket: StoredBracket,
): { position: DivisionPosition; name: string; combatants: CombatantRow[] }[] =>
  DIVISION_POSITIONS.map(position => ({
    position,
    name: bracket.divisions[position].name,
    combatants: listDivisionSeedSlots(bracket, position).flatMap(
      ({ seed, combatant }): CombatantRow[] =>
        combatant === undefined
          ? bracket.wildCard.entrants.map(entrant => ({
              ...entrant,
              seed,
              isWildCardEntrant: true,
            }))
          : [{ ...combatant, seed, isWildCardEntrant: false }],
    ),
  }))

/**
 * Names the combatant `name`, which the route has checked, unless another
 * combatant in the year's bracket has the same name. A `formError` isn't about
 * the name
 */
export const renameCombatant = (
  year: number,
  combatantId: string,
  name: string,
): Promise<{ ok: true } | { error: string } | { formError: string }> =>
  // Alone, so a merge or another rename can't take the name after the check
  withCurrentYearAlone(async (tx, current) => {
    if (current?.year !== year) {
      return {
        formError: `The ${year} bracket isn’t current. Reload the page`,
      }
    }
    const combatants = await tx.combatant.findMany({
      where: { year },
      select: { id: true, name: true },
    })
    if (!combatants.some(({ id }) => id === combatantId)) {
      return { error: `That combatant isn’t in the ${year} bracket` }
    }
    const others = combatants.filter(({ id }) => id !== combatantId)
    const taken = others.find(other => isSameName(other.name, name))
    if (taken) {
      return { error: describeTakenName(taken.name) }
    }
    await tx.combatant.update({ where: { id: combatantId }, data: { name } })
    return { ok: true }
  })

const RESULTS = {
  where: { result: { isNot: null } },
  select: {
    round: true,
    index: true,
    result: { select: { winnerId: true } },
  },
} satisfies Prisma.BattleFindManyArgs
