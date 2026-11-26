import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  bracketInputSchema,
  findDuplicateNames,
  toBracketSchema,
} from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'
import { DIVISION_POSITIONS, listBattles, toBattleKey } from './bracket.ts'
import type { DivisionPosition } from './bracket.ts'
import { prisma } from './db.server.ts'
import { Prisma } from './generated/prisma/client.ts'
import { listSeedSlots } from './seeded-bracket.ts'
import type { Combatant, StoredBracket } from './seeded-bracket.ts'

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
  })
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

  const divisionRows = DIVISION_POSITIONS.map(position => ({
    id: randomUUID(),
    year,
    position,
    name: input.divisions[position].name,
  }))
  const divisionIds = Object.fromEntries(
    divisionRows.map(({ id, position }) => [position, id]),
  ) as Record<DivisionPosition, string>
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
    divisions: divisionRows,
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
  expectedLockDate: Date | null
} | null> => {
  const bracket = await prisma.bracket.findFirst({
    ...CURRENT_BRACKET,
    select: BRACKET_SELECT,
  })
  return (
    bracket && {
      year: bracket.year,
      bracket: readStoredBracket(bracket),
      expectedLockDate: bracket.expectedLockDate,
    }
  )
}

/** Null before any bracket is published */
export const readCurrentYear = async (
  db: Prisma.TransactionClient = prisma,
): Promise<number | null> => {
  const bracket = await db.bracket.findFirst({
    ...CURRENT_BRACKET,
    select: { year: true },
  })
  return bracket?.year ?? null
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
 * The year's bracket with its battles' row IDs, keyed by `toBattleKey`, or
 * null when it has none
 */
type BracketRows = {
  bracket: StoredBracket
  battleIdByKey: ReadonlyMap<string, string>
}

export const readBracketRows = async (
  year: number,
  db: Prisma.TransactionClient,
): Promise<BracketRows | null> => {
  const bracket = await db.bracket.findUnique({
    where: { year },
    select: { year: true },
  })
  if (!bracket) {
    return null
  }
  const stored = await readBracketInTransaction(db, year)
  const battles = await db.battle.findMany({
    where: { year },
    select: { id: true, round: true, index: true },
  })
  return {
    bracket: stored,
    battleIdByKey: new Map(
      battles.map(battle => [toBattleKey(battle), battle.id]),
    ),
  }
}

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

export type Phase = `SETUP` | `OPEN`

export type BracketSummary = { expectedLockDate: Date | null } & (
  | { phase: `SETUP` }
  // Unpublishing stops once the year has a contest
  | { phase: `OPEN`; publishedAt: Date; hasContests: boolean }
)

/** Null when the year has no bracket */
export const readBracketSummary = async (
  year: number,
): Promise<BracketSummary | null> => {
  const bracket = await prisma.bracket.findUnique({
    where: { year },
    select: {
      publishedAt: true,
      expectedLockDate: true,
      _count: { select: { contests: true } },
    },
  })
  if (!bracket) {
    return null
  }
  const { publishedAt, expectedLockDate, _count } = bracket
  return publishedAt
    ? {
        phase: `OPEN`,
        publishedAt,
        expectedLockDate,
        hasContests: _count.contests > 0,
      }
    : { phase: `SETUP`, expectedLockDate }
}

export type PublicationChange = `CHANGED` | `UNCHANGED` | `HAS_CONTESTS`

/**
 * Publishing moves the year from Setup to Open, and unpublishing moves it back
 * until the year has a contest. `UNCHANGED` means the year has no bracket, or
 * its bracket is already in that state
 */
export const setBracketPublished = (
  year: number,
  published: boolean,
): Promise<PublicationChange> =>
  prisma.$transaction(async tx => {
    const publication = await lockYear(tx, year, `UPDATE`)
    if (!publication || (publication !== `UNPUBLISHED`) === published) {
      return `UNCHANGED`
    }
    if (
      !published &&
      (await tx.contest.findFirst({ where: { year }, select: { id: true } }))
    ) {
      return `HAS_CONTESTS`
    }
    await tx.bracket.update({
      where: { year },
      data: { publishedAt: published ? new Date() : null },
    })
    return `CHANGED`
  })

/** Only the current year takes new players */
export const isCurrentYear = async (year: number): Promise<boolean> =>
  (await readCurrentYear()) === year

/** A current year is published, and no newer year is */
export type YearPublication = `UNPUBLISHED` | `PUBLISHED` | `CURRENT`

/**
 * Holds which years are published and current until the transaction ends, so
 * neither can change before then. Writes that depend on them take `SHARE`,
 * which lets them run together, and publishing and unpublishing take `UPDATE`.
 * One advisory lock covers every year, including a bracket inserted after the
 * lock is taken
 */
export const lockYears = async (
  tx: Prisma.TransactionClient,
  mode: `SHARE` | `UPDATE`,
): Promise<void> => {
  await (mode === `SHARE`
    ? tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${YEARS_LOCK_KEY})`
    : tx.$executeRaw`SELECT pg_advisory_xact_lock(${YEARS_LOCK_KEY})`)
}

/** An arbitrary key no other advisory lock in the app uses */
const YEARS_LOCK_KEY = 7_041_903

/**
 * Locks one year's bracket against other saves and changes to its expected lock
 * date until the transaction ends.
 * Postgres keeps two-key advisory locks apart from one-key ones, so it never
 * waits on `lockYears`
 */
const lockYearForSaving = async (
  tx: Prisma.TransactionClient,
  year: number,
): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${YEARS_LOCK_KEY}::int, ${year}::int)`
}

/**
 * Takes `lockYears`, then reads whether the year is published and current.
 * Null when the year has no bracket
 */
export const lockYear = async (
  tx: Prisma.TransactionClient,
  year: number,
  mode: `SHARE` | `UPDATE`,
): Promise<YearPublication | null> => {
  await lockYears(tx, mode)
  const bracket = await tx.bracket.findUnique({
    where: { year },
    select: { publishedAt: true },
  })
  if (!bracket) {
    return null
  }
  if (bracket.publishedAt === null) {
    return `UNPUBLISHED`
  }
  return (await readCurrentYear(tx)) === year ? `CURRENT` : `PUBLISHED`
}

/** Returns whether the year has a bracket. Null clears the date */
export const setExpectedLockDate = (
  year: number,
  expectedLockDate: Date | null,
): Promise<boolean> =>
  prisma.$transaction(async tx => {
    // A save of the bracket reinserts the date it read
    await lockYearForSaving(tx, year)
    const { count } = await tx.bracket.updateMany({
      where: { year },
      data: { expectedLockDate },
    })
    return count > 0
  })

export type CombatantRow = Combatant & { isWildCardEntrant: boolean }

/**
 * Each division's combatants in seed order, with the wild card's entrants at
 * its seed
 */
export const readBracketCombatants = async (
  year: number,
): Promise<
  { position: DivisionPosition; name: string; combatants: CombatantRow[] }[]
> => {
  const bracket = await readBracket(year)
  if (!bracket) {
    return []
  }
  const seedSlots = listSeedSlots(bracket)
  return DIVISION_POSITIONS.map(position => ({
    position,
    name: bracket.divisions[position].name,
    combatants: seedSlots
      .filter(seedSlot => seedSlot.position === position)
      .flatMap(({ seed, combatant }): CombatantRow[] =>
        combatant === undefined
          ? bracket.wildCard.entrants.map(entrant => ({
              ...entrant,
              seed,
              isWildCardEntrant: true,
            }))
          : [{ ...combatant, seed, isWildCardEntrant: false }],
      ),
  }))
}

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
    return { error: `That combatant isn't in the ${year} bracket` }
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

const BRACKET_SELECT = {
  year: true,
  expectedLockDate: true,
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
  ({ name }) => name,
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
