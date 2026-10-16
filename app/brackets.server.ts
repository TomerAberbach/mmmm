import { randomUUID } from 'node:crypto'
import { bracketInputSchema, listSeedSlotNames } from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'
import { DIVISION_POSITIONS, listBattles } from './bracket.ts'
import type { DivisionPosition } from './bracket.ts'
import { prisma } from './db.server.ts'
// Stores an unpublished bracket for the year, with every seed slot and battle.
// Throws on input `bracketInputSchema` rejects, or when the year already has a
// bracket
export const createBracket = async (
  yearId: number,
  input: BracketInput,
): Promise<string> => {
  const rows = buildBracketRows(randomUUID(), bracketInputSchema.parse(input))
  await prisma.$transaction([
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
  ])
  return rows.bracketId
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
    select: {
      yearId: true,
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
    },
  })
  if (!bracket) {
    return null
  }
  // Parsing checks the stored rows form a whole bracket, and narrows seeds
  const input = bracketInputSchema.parse({
    divisions: Object.fromEntries(
      bracket.divisions.map(({ position, name, seedSlots }) => [
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
    wildCard: bracket.wildCard && {
      position: bracket.wildCard.seedSlot.division.position,
      seed: bracket.wildCard.seedSlot.seed,
      entrants: bracket.wildCard.entrants.map(
        ({ combatant }) => combatant.name,
      ),
    },
  })
  return { year: bracket.yearId, input }
}
