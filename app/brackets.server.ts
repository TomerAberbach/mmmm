import { randomUUID } from 'node:crypto'
import {
  bracketInputSchema,
  findDuplicateNames,
  listSeedSlotNames,
} from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'
import { DIVISION_POSITIONS, listBattles, toBattleKey } from './bracket.ts'
import type { DivisionPosition } from './bracket.ts'
import { prisma } from './db.server.ts'
import { Prisma } from './generated/prisma/client.ts'
// Stores an unpublished bracket for the year, with every seed slot and battle.
// Throws on input `bracketInputSchema` rejects, or when the year already has a
// bracket
export const createBracket = async (
  yearId: number,
  input: BracketInput,
): Promise<string> => {
  const { bracketId, operations } = buildCreateOperations(yearId, input)
  await prisma.$transaction(operations)
  return bracketId
}

// Replaces the year's unpublished bracket, keeping its expected lock date, or
// stores a new one. Returns false and changes nothing when the year's bracket
// is published
export const saveUnpublishedBracket = async (
  yearId: number,
  input: BracketInput,
): Promise<boolean> => {
  const existing = await prisma.bracket.findUnique({
    where: { yearId },
    select: { expectedLockDate: true },
  })
  const { operations } = buildCreateOperations(
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
  return {
    bracketId: rows.bracketId,
    operations: [
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
    ],
  }
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
export const readCurrentYear = async (): Promise<number | null> => {
  const bracket = await prisma.bracket.findFirst({
    ...CURRENT_BRACKET,
    select: { yearId: true },
  })
  return bracket?.yearId ?? null
}

// The year's bracket, published or not, or null when it has none
export const readBracket = async (
  yearId: number,
): Promise<{
  input: BracketInput
  publishedAt: Date | null
  expectedLockDate: Date | null
} | null> => {
  const bracket = await prisma.bracket.findUnique({
    where: { yearId },
    select: BRACKET_SELECT,
  })
  return (
    bracket && {
      input: readStoredInput(bracket),
      publishedAt: bracket.publishedAt,
      expectedLockDate: bracket.expectedLockDate,
    }
  )
}

// The year's bracket with the row IDs that picks reference, or null when it
// has none
export const readBracketRows = async (
  yearId: number,
): Promise<{
  input: BracketInput
  battleIdByKey: ReadonlyMap<string, string>
  combatantIdByName: ReadonlyMap<string, string>
} | null> => {
  const bracket = await prisma.bracket.findUnique({
    where: { yearId },
    select: {
      ...BRACKET_SELECT,
      battles: { select: { id: true, round: true, index: true } },
      combatants: { select: { id: true, name: true } },
    },
  })
  return (
    bracket && {
      input: readStoredInput(bracket),
      battleIdByKey: new Map(
        bracket.battles.map(battle => [toBattleKey(battle), battle.id]),
      ),
      combatantIdByName: new Map(
        bracket.combatants.map(({ id, name }) => [name, id]),
      ),
    }
  )
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
    const bracket = await lockBracketRow(tx, yearId)
    if (!bracket || bracket.isPublished === published) {
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

// Locks the year's bracket row until the transaction ends, so publishing and
// creating a contest wait for each other. Undefined when the year has no
// bracket
export const lockBracketRow = async (
  tx: Prisma.TransactionClient,
  yearId: number,
): Promise<{ isPublished: boolean } | undefined> => {
  const [bracket] = await tx.$queryRaw<{ isPublished: boolean }[]>`
    SELECT "publishedAt" IS NOT NULL AS "isPublished" FROM "Bracket"
    WHERE "yearId" = ${yearId} FOR UPDATE`
  return bracket
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
  const divisions = await prisma.division.findMany({
    where: { bracket: { yearId } },
    select: {
      position: true,
      name: true,
      seedSlots: {
        orderBy: { seed: `asc` },
        select: {
          seed: true,
          combatant: { select: { id: true, name: true } },
          wildCard: {
            select: {
              entrants: {
                orderBy: { index: `asc` },
                select: { combatant: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
  })
  return DIVISION_POSITIONS.flatMap(position =>
    divisions
      .filter(division => division.position === position)
      .map(({ name, seedSlots }) => ({
        position,
        name,
        combatants: seedSlots.flatMap(
          ({ seed, combatant, wildCard }): CombatantRow[] =>
            combatant
              ? [{ ...combatant, seed, isWildCardEntrant: false }]
              : (wildCard?.entrants ?? []).map(entrant => ({
                  ...entrant.combatant,
                  seed,
                  isWildCardEntrant: true,
                })),
        ),
      })),
  )
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
  publishedAt: true,
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
}: Prisma.BracketGetPayload<{ select: typeof BRACKET_SELECT }>): BracketInput =>
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
