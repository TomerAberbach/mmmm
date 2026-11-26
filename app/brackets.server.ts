import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  bracketInputSchema,
  findDuplicateNames,
  listDivisionSeedSlots,
  listSeedSlots,
  toBracketSchema,
} from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'
import {
  DIVISION_POSITIONS,
  listBattles,
  mapDivisions,
  toBattleKey,
} from './bracket.ts'
import type { BattleRef, DivisionPosition } from './bracket.ts'
import { prisma } from './db.server.ts'
import { Prisma } from './generated/prisma/client.ts'
import type { Results } from './results.ts'
import type { Combatant, StoredBracket } from './seeded-bracket.ts'
import { readUpcomingYear } from './year.ts'

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
    battles: listBattles().map(battle => ({ id: randomUUID(), ...battle })),
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

/** The current year's bracket is the newest published one */
const CURRENT_BRACKET = {
  where: { publishedAt: { not: null } },
  orderBy: { year: `desc` },
} satisfies Prisma.BracketFindFirstArgs

/** Null before any bracket is published */
export const readCurrentBracket = async (): Promise<{
  year: number
  bracket: StoredBracket
  /** Null once the year locks, as without a date */
  expectedLockDate: Date | null
  results: Results
} | null> => {
  const bracket = await prisma.bracket.findFirst({
    ...CURRENT_BRACKET,
    select: {
      ...BRACKET_SELECT,
      year: true,
      expectedLockDate: true,
      lockedAt: true,
      battles: RESULTS,
    },
  })
  return (
    bracket && {
      year: bracket.year,
      bracket: readStoredBracket(bracket),
      expectedLockDate: bracket.lockedAt ? null : bracket.expectedLockDate,
      results: toResults(bracket.battles),
    }
  )
}

/** `isLocked` once the year's first result is saved, until the admin reopens */
export type CurrentYear = { year: number; isLocked: boolean }

/** Null before any bracket is published */
export const readCurrentYear = async (
  db: Prisma.TransactionClient = prisma,
): Promise<CurrentYear | null> => {
  const bracket = await db.bracket.findFirst({
    ...CURRENT_BRACKET,
    select: { year: true, lockedAt: true },
  })
  return bracket && { year: bracket.year, isLocked: bracket.lockedAt !== null }
}

/** The year's bracket, published or not, or null when it has none */
export const readBracket = async (
  year: number,
): Promise<StoredBracket | null> => {
  const bracket = await prisma.bracket.findUnique({
    where: { year },
    select: BRACKET_SELECT,
  })
  return bracket && readStoredBracket(bracket)
}

/**
 * The year's bracket with its battles' row IDs, keyed by `toBattleKey`. The
 * year must have a bracket
 */
export const readBracketRows = async (
  year: number,
  db: Prisma.TransactionClient,
): Promise<{
  bracket: StoredBracket
  battleIdByKey: ReadonlyMap<string, string>
}> => {
  const bracket = await readBracketInTransaction(db, year)
  const battles = await db.battle.findMany({
    where: { year },
    select: { id: true, round: true, index: true },
  })
  return {
    bracket,
    battleIdByKey: new Map(
      battles.map(battle => [toBattleKey(battle), battle.id]),
    ),
  }
}

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
 * One relation a query, because Prisma loads sibling relations at once, and a
 * transaction's connection runs one query at a time
 */
const readBracketInTransaction = async (
  db: Prisma.TransactionClient,
  year: number,
): Promise<StoredBracket> => {
  const where = { year }
  const divisions = await db.division.findMany({
    where,
    select: BRACKET_SELECT.divisions.select,
  })
  const wildCard = await db.wildCard.findUnique({
    where,
    select: { seedSlot: BRACKET_SELECT.wildCard.select.seedSlot },
  })
  const entrants = await db.wildCardEntrant.findMany({
    where: { wildCard: where },
    ...BRACKET_SELECT.wildCard.select.entrants,
  })
  return readStoredBracket({
    divisions,
    wildCard: wildCard && { ...wildCard, entrants },
  })
}

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
  `CHANGED` | `UNCHANGED` | `HAS_CONTESTS` | `LOCKED` | `NO_CHAMPION`

/**
 * Publishing moves the year from Setup to Open, and unpublishing moves it back
 * until the year has a contest or locks. A newer year waits for the current
 * year's champion, since publishing it archives the current year's results.
 * `UNCHANGED` means the year has no bracket, or its bracket is already in that
 * state
 */
export const setBracketPublished = (
  year: number,
  published: boolean,
): Promise<PublicationChange> =>
  withCurrentYearAlone(async (tx, current) => {
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
    return count > 0 ? `CHANGED` : `UNCHANGED`
  })

/**
 * Only the current year takes new players, and only until it locks. Once it
 * stops, players can't submit or edit either
 */
export const isOpenYear = async (year: number): Promise<boolean> =>
  isOpen(await readCurrentYear(), year)

export const isOpen = (current: CurrentYear | null, year: number): boolean =>
  current?.year === year && !current.isLocked

type CurrentYearChange<Result> = (
  tx: Prisma.TransactionClient,
  current: CurrentYear | null,
) => Promise<Result>

/**
 * Runs `change` in a transaction with the current year, which stays current,
 * and locked or not, until the transaction ends. Null before any bracket is
 * published. It locks the years before `change` can lock a row, so every
 * transaction takes its locks in one order
 */
export const withCurrentYear = <Result>(
  change: CurrentYearChange<Result>,
): Promise<Result> => withLockedYears(`SHARE`, change)

/**
 * Runs `change` as `withCurrentYear` does, alone, so it can change which year
 * is current or whether it's locked
 */
export const withCurrentYearAlone = <Result>(
  change: CurrentYearChange<Result>,
): Promise<Result> => withLockedYears(`UPDATE`, change)

const withLockedYears = <Result>(
  mode: LockMode,
  change: CurrentYearChange<Result>,
): Promise<Result> =>
  prisma.$transaction(async tx => {
    await lockYears(tx, mode)
    return change(tx, await readCurrentYear(tx))
  }, LOCKED_YEARS_LIMITS)

/**
 * Saving a result scores every submission of the year, which took 3 seconds for
 * 20,000 of them, and other changes wait for it
 */
const LOCKED_YEARS_LIMITS = {
  timeout: 30_000,
  // Waiting changes can hold every connection. The pool itself waits 5 seconds
  maxWait: 5000,
}

type LockMode = `SHARE` | `UPDATE`

/**
 * Holds which years are published, current, and locked until the transaction
 * ends. Writes that depend on them take `SHARE`, which lets them run together,
 * and writes that change them take `UPDATE`. One advisory lock covers every
 * year, including a bracket inserted after the lock is taken
 */
const lockYears = async (
  tx: Prisma.TransactionClient,
  mode: LockMode,
): Promise<void> => {
  await (mode === `SHARE`
    ? tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${YEARS_LOCK_KEY})`
    : tx.$executeRaw`SELECT pg_advisory_xact_lock(${YEARS_LOCK_KEY})`)
}

/** An arbitrary key no other advisory lock in the app uses */
const YEARS_LOCK_KEY = 7_041_903

/**
 * Locks one year's bracket against other saves and changes to its expected lock
 * date until the transaction ends. Postgres keeps two-key advisory locks apart
 * from one-key ones, so it never waits on `lockYears`
 */
const lockYearForSaving = async (
  tx: Prisma.TransactionClient,
  year: number,
): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${YEARS_LOCK_KEY}::int, ${year}::int)`
}

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
 * combatant in the year's bracket has the same name
 */
export const renameCombatant = async (
  year: number,
  combatantId: string,
  name: string,
): Promise<{ ok: true } | { error: string }> => {
  const combatants = await prisma.combatant.findMany({
    where: { year },
    select: { id: true, name: true },
  })
  if (!combatants.some(({ id }) => id === combatantId)) {
    return { error: `That combatant isn’t in the ${year} bracket` }
  }
  const others = combatants.filter(({ id }) => id !== combatantId)
  const duplicate = findDuplicateNames([
    ...others.map(combatant => ({ place: combatant.id, name: combatant.name })),
    { place: combatantId, name },
  ]).find(({ place }) => place === combatantId)
  if (duplicate) {
    const other = others.find(({ id }) => id === duplicate.other)!
    return {
      error: describeTakenName(other.name),
    }
  }
  try {
    await prisma.combatant.update({
      where: { id: combatantId },
      data: { name },
    })
  } catch (error) {
    // A concurrent rename took the name after the check
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === `P2002`
    ) {
      return {
        error: describeTakenName(name),
      }
    }
    throw error
  }
  return { ok: true }
}

const RESULTS = {
  where: { result: { isNot: null } },
  select: {
    round: true,
    index: true,
    result: { select: { winnerId: true } },
  },
} satisfies Prisma.BattleFindManyArgs

const BRACKET_SELECT = {
  divisions: {
    select: {
      position: true,
      name: true,
      seedSlots: {
        orderBy: { seed: `asc` },
        select: { combatant: { select: { id: true, name: true } } },
      },
    },
  },
  wildCard: {
    select: {
      seedSlot: {
        select: { seed: true, division: { select: { position: true } } },
      },
      entrants: {
        orderBy: { index: `asc` },
        select: { combatant: { select: { id: true, name: true } } },
      },
    },
  },
} satisfies Prisma.BracketSelect

const storedBracketSchema = toBracketSchema(
  z.object({ id: z.string(), name: z.string() }),
)

/** Parsing checks the stored rows form a whole bracket, and narrows seeds */
const readStoredBracket = ({
  divisions,
  wildCard,
}: Pick<
  Prisma.BracketGetPayload<{ select: typeof BRACKET_SELECT }>,
  `divisions` | `wildCard`
>): StoredBracket =>
  storedBracketSchema.parse({
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
      entrants: wildCard.entrants.map(({ combatant }) => combatant),
    },
  })

const describeTakenName = (name: string): string =>
  `${name} is already a combatant. Give each combatant its own name`
