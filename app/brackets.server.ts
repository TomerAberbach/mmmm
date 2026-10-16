import { randomUUID } from 'node:crypto'
import { bracketInputSchema, listSeedSlotNames } from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'
import { DIVISION_POSITIONS, listBattles } from './bracket.ts'
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

// Replaces the year's unpublished bracket, or stores a new one. Returns false
// and changes nothing when the year's bracket is published
export const saveUnpublishedBracket = async (
  yearId: number,
  input: BracketInput,
): Promise<boolean> => {
  const { operations } = buildCreateOperations(yearId, input)
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

const buildCreateOperations = (yearId: number, input: BracketInput) => {
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

// The current year's bracket: the newest published one, or null before any is
// published
export const readCurrentBracket = async (): Promise<{
  year: number
  input: BracketInput
} | null> => {
  const bracket = await prisma.bracket.findFirst({
    where: { publishedAt: { not: null } },
    orderBy: { yearId: `desc` },
    select: BRACKET_SELECT,
  })
  return bracket && { year: bracket.yearId, input: readStoredInput(bracket) }
}

// The year's bracket, published or not, or null when it has none
export const readBracket = async (
  yearId: number,
): Promise<{ input: BracketInput; isPublished: boolean } | null> => {
  const bracket = await prisma.bracket.findUnique({
    where: { yearId },
    select: BRACKET_SELECT,
  })
  return (
    bracket && {
      input: readStoredInput(bracket),
      isPublished: bracket.publishedAt !== null,
    }
  )
}

export type BracketPublication = `missing` | `unpublished` | `published`

export const readBracketPublication = async (
  yearId: number,
): Promise<BracketPublication> => {
  const bracket = await prisma.bracket.findUnique({
    where: { yearId },
    select: { publishedAt: true },
  })
  if (!bracket) {
    return `missing`
  }
  return bracket.publishedAt ? `published` : `unpublished`
}

const BRACKET_SELECT = {
  yearId: true,
  publishedAt: true,
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
