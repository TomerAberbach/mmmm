import { randomUUID } from 'node:crypto'
import { bracketInputSchema, findDuplicateNames } from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'
import { DIVISION_POSITIONS, listBattles, toBattleKey } from './bracket.ts'
import type { DivisionPosition } from './bracket.ts'
import { prisma } from './db.server.ts'
import { Prisma } from './generated/prisma/client.ts'
import { listSeedSlotNames } from './seeded-bracket.ts'

// Replaces the year's unpublished bracket, keeping its expected lock date, or
// stores a new one with every seed slot and battle. Returns false and changes
// nothing when the year's bracket is published. Throws on input
// `bracketInputSchema` rejects
export const saveUnpublishedBracket = async (
  yearId: number,
  input: BracketInput,
): Promise<boolean> => {
  const existing = await prisma.bracket.findUnique({
    where: { yearId },
    select: { expectedLockDate: true },
  })
  const operations = buildCreateOperations(
    yearId,
    input,
    existing?.expectedLockDate,
  )
  try {
    await prisma.$transaction([
      prisma.bracket.deleteMany({ where: { yearId, publishedAt: null } }),
      ...operations,
    ])
    return true
  } catch (error) {
    // A published bracket survives the delete, so the new one's year
    // collides with it. Validated names can't collide with each other
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === `P2002`
    ) {
      return false
    }
    throw error
  }
}

// Returns whether the year had an unpublished bracket to delete
export const deleteUnpublishedBracket = async (
  yearId: number,
): Promise<boolean> => {
  const { count } = await prisma.bracket.deleteMany({
    where: { yearId, publishedAt: null },
  })
  return count > 0
}

const buildCreateOperations = (
  yearId: number,
  input: BracketInput,
  expectedLockDate?: Date | null,
) => {
  const rows = buildBracketRows(randomUUID(), bracketInputSchema.parse(input))
  return [
    prisma.year.upsert({
      where: { id: yearId },
      update: {},
      create: { id: yearId },
    }),
    prisma.bracket.create({
      data: {
        id: rows.bracketId,
        yearId,
        expectedLockDate,
        battles: { createMany: { data: rows.battles } },
      },
    }),
    prisma.combatant.createMany({ data: rows.combatants }),
    prisma.division.createMany({ data: rows.divisions }),
    prisma.seedSlot.createMany({ data: rows.seedSlots }),
    prisma.wildCard.create({ data: rows.wildCard }),
    prisma.wildCardEntrant.createMany({ data: rows.wildCardEntrants }),
  ]
}

// Every row of the bracket, linked by IDs made here, so each table takes one
// insert
const buildBracketRows = (bracketId: string, input: BracketInput) => {
  const combatants: { id: string; bracketId: string; name: string }[] = []
  const addCombatant = (name: string): string => {
    const id = randomUUID()
    combatants.push({ id, bracketId, name })
    return id
  }
  const wildCardSlotId = randomUUID()

  const divisionRows = DIVISION_POSITIONS.map(position => ({
    id: randomUUID(),
    bracketId,
    position,
    name: input.divisions[position].name,
  }))
  const divisionIds = Object.fromEntries(
    divisionRows.map(({ id, position }) => [position, id]),
  ) as Record<DivisionPosition, string>
  const seedSlots = listSeedSlotNames(input).map(({ position, seed, name }) =>
    name === undefined
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
          combatantId: addCombatant(name),
        },
  )

  const wildCardId = randomUUID()
  return {
    bracketId,
    battles: listBattles().map(battle => ({ id: randomUUID(), ...battle })),
    divisions: divisionRows,
    seedSlots,
    wildCard: { id: wildCardId, bracketId, seedSlotId: wildCardSlotId },
    wildCardEntrants: input.wildCard.entrants.map((name, index) => ({
      wildCardId,
      index,
      combatantId: addCombatant(name),
    })),
    combatants,
  }
}

// The current year's bracket is the newest published one
const CURRENT_BRACKET = {
  where: { publishedAt: { not: null } },
  orderBy: { yearId: `desc` },
} satisfies Prisma.BracketFindFirstArgs

// Null before any bracket is published
export const readCurrentBracket = async (): Promise<{
  year: number
  input: BracketInput
  expectedLockDate: Date | null
} | null> => {
  const bracket = await prisma.bracket.findFirst({
    ...CURRENT_BRACKET,
    select: BRACKET_SELECT,
  })
  return (
    bracket && {
      year: bracket.yearId,
      input: readStoredInput(bracket),
      expectedLockDate: bracket.expectedLockDate,
    }
  )
}

// Null before any bracket is published
export const readCurrentYear = async (
  db: Prisma.TransactionClient = prisma,
): Promise<number | null> => {
  const bracket = await db.bracket.findFirst({
    ...CURRENT_BRACKET,
    select: { yearId: true },
  })
  return bracket?.yearId ?? null
}

// The year's bracket, published or not, or null when it has none
export const readBracket = async (
  yearId: number,
): Promise<BracketInput | null> => {
  const bracket = await prisma.bracket.findUnique({
    where: { yearId },
    select: BRACKET_SELECT,
  })
  return bracket && readStoredInput(bracket)
}

// The year's bracket with the row IDs that picks reference, or null when it
// has none
export type BracketRows = {
  input: BracketInput
  battleIdByKey: ReadonlyMap<string, string>
  combatantIdByName: ReadonlyMap<string, string>
}

export const readBracketRows = async (
  yearId: number,
  db: Prisma.TransactionClient = prisma,
): Promise<BracketRows | null> => {
  const bracket = await db.bracket.findUnique({
    where: { yearId },
    select: { id: true },
  })
  if (!bracket) {
    return null
  }
  const where = { bracketId: bracket.id }
  const input = await readBracketInput(db, bracket.id)
  const battles = await db.battle.findMany({
    where,
    select: { id: true, round: true, index: true },
  })
  const combatants = await db.combatant.findMany({
    where,
    select: { id: true, name: true },
  })
  return {
    input,
    battleIdByKey: new Map(
      battles.map(battle => [toBattleKey(battle), battle.id]),
    ),
    combatantIdByName: new Map(combatants.map(({ id, name }) => [name, id])),
  }
}

// One relation a query, because Prisma loads sibling relations at once, and a
// transaction's connection runs one query at a time
const readBracketInput = async (
  db: Prisma.TransactionClient,
  bracketId: string,
): Promise<BracketInput> => {
  const where = { bracketId }
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
  return readStoredInput({
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

// Null when the year has no bracket
export const readBracketSummary = async (
  yearId: number,
): Promise<BracketSummary | null> => {
  const bracket = await prisma.bracket.findUnique({
    where: { yearId },
    select: {
      publishedAt: true,
      expectedLockDate: true,
      year: { select: { _count: { select: { contests: true } } } },
    },
  })
  if (!bracket) {
    return null
  }
  const { publishedAt, expectedLockDate, year } = bracket
  return publishedAt
    ? {
        phase: `OPEN`,
        publishedAt,
        expectedLockDate,
        hasContests: year._count.contests > 0,
      }
    : { phase: `SETUP`, expectedLockDate }
}

export type PublicationChange = `CHANGED` | `UNCHANGED` | `HAS_CONTESTS`

// Publishing moves the year from Setup to Open, and unpublishing moves it back
// until the year has a contest. `UNCHANGED` means the year has no bracket, or
// its bracket is already in that state
export const setBracketPublished = (
  yearId: number,
  published: boolean,
): Promise<PublicationChange> =>
  prisma.$transaction(async tx => {
    const publication = await lockYear(tx, yearId, `UPDATE`)
    if (!publication || (publication !== `UNPUBLISHED`) === published) {
      return `UNCHANGED`
    }
    if (
      !published &&
      (await tx.contest.findFirst({ where: { yearId }, select: { id: true } }))
    ) {
      return `HAS_CONTESTS`
    }
    await tx.bracket.update({
      where: { yearId },
      data: { publishedAt: published ? new Date() : null },
    })
    return `CHANGED`
  })

// A current year is published, and no newer year is
export type YearPublication = `UNPUBLISHED` | `PUBLISHED` | `CURRENT`

// Holds which years are published and current until the transaction ends, so
// neither can change before then. Writes that depend on them take `SHARE`,
// which lets them run together, and publishing and unpublishing take `UPDATE`.
// One advisory lock covers every year, including a bracket inserted after the
// lock is taken
export const lockYears = async (
  tx: Prisma.TransactionClient,
  mode: `SHARE` | `UPDATE`,
): Promise<void> => {
  await (mode === `SHARE`
    ? tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${YEARS_LOCK_KEY})`
    : tx.$executeRaw`SELECT pg_advisory_xact_lock(${YEARS_LOCK_KEY})`)
}

// An arbitrary key no other advisory lock in the app uses
const YEARS_LOCK_KEY = 7_041_903

// Takes `lockYears`, then reads whether the year is published and current.
// Null when the year has no bracket
export const lockYear = async (
  tx: Prisma.TransactionClient,
  yearId: number,
  mode: `SHARE` | `UPDATE`,
): Promise<YearPublication | null> => {
  await lockYears(tx, mode)
  const bracket = await tx.bracket.findUnique({
    where: { yearId },
    select: { publishedAt: true },
  })
  if (!bracket) {
    return null
  }
  if (bracket.publishedAt === null) {
    return `UNPUBLISHED`
  }
  return (await readCurrentYear(tx)) === yearId ? `CURRENT` : `PUBLISHED`
}

// Returns whether the year has a bracket. Null clears the date
export const setExpectedLockDate = async (
  yearId: number,
  expectedLockDate: Date | null,
): Promise<boolean> => {
  const { count } = await prisma.bracket.updateMany({
    where: { yearId },
    data: { expectedLockDate },
  })
  return count > 0
}

export type CombatantRow = {
  id: string
  name: string
  seed: number
  isWildCardEntrant: boolean
}

// Each division's combatants in seed order, with the wild card's entrants at
// its seed
export const readBracketCombatants = async (
  yearId: number,
): Promise<
  { position: DivisionPosition; name: string; combatants: CombatantRow[] }[]
> => {
  const bracket = await readBracketRows(yearId)
  if (!bracket) {
    return []
  }
  const { input, combatantIdByName } = bracket
  const toRow = (
    name: string,
    seed: number,
    isWildCardEntrant: boolean,
  ): CombatantRow => ({
    id: combatantIdByName.get(name)!,
    name,
    seed,
    isWildCardEntrant,
  })
  const seedSlots = listSeedSlotNames(input)
  return DIVISION_POSITIONS.map(position => ({
    position,
    name: input.divisions[position].name,
    combatants: seedSlots
      .filter(slot => slot.position === position)
      .flatMap(({ seed, name }) =>
        name === undefined
          ? input.wildCard.entrants.map(entrant => toRow(entrant, seed, true))
          : [toRow(name, seed, false)],
      ),
  }))
}

// Names the combatant `name`, which the route has checked, unless another
// combatant in the year's bracket has the same name
export const renameCombatant = async (
  yearId: number,
  combatantId: string,
  name: string,
): Promise<{ ok: true } | { error: string }> => {
  const combatants = await prisma.combatant.findMany({
    where: { bracket: { yearId } },
    select: { id: true, name: true },
  })
  if (!combatants.some(({ id }) => id === combatantId)) {
    return { error: `That combatant isn't in the ${yearId} bracket` }
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
  yearId: true,
  expectedLockDate: true,
  divisions: {
    select: {
      position: true,
      name: true,
      seedSlots: {
        orderBy: { seed: `asc` },
        select: { combatant: { select: { name: true } } },
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
        select: { combatant: { select: { name: true } } },
      },
    },
  },
} satisfies Prisma.BracketSelect

// Parsing checks the stored rows form a whole bracket, and narrows seeds
const readStoredInput = ({
  divisions,
  wildCard,
}: Pick<
  Prisma.BracketGetPayload<{ select: typeof BRACKET_SELECT }>,
  `divisions` | `wildCard`
>): BracketInput =>
  bracketInputSchema.parse({
    divisions: Object.fromEntries(
      divisions.map(({ position, name, seedSlots }) => [
        position,
        {
          name,
          // The wild card's slot holds no combatant, as the input skips it
          combatants: seedSlots
            .map(({ combatant }) => combatant?.name)
            .filter(combatantName => combatantName !== undefined),
        },
      ]),
    ),
    wildCard: wildCard && {
      position: wildCard.seedSlot.division.position,
      seed: wildCard.seedSlot.seed,
      entrants: wildCard.entrants.map(({ combatant }) => combatant.name),
    },
  })

const describeTakenName = (name: string): string =>
  `${name} is already a combatant. Give each combatant its own name`
