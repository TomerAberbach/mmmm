import { randomUUID } from 'node:crypto'
import { bracketInputSchema } from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'
import { DIVISION_POSITIONS, listBattles, SEEDS } from './bracket.ts'
import type { Seed } from './bracket.ts'
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
const buildBracketRows = (
  bracketId: string,
  { divisions, wildCard }: BracketInput,
) => {
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
    name: divisions[position].name,
  }))
  const seedSlots = divisionRows.flatMap(({ id: divisionId, position }) =>
    buildSeedSlots(
      divisionId,
      divisions[position].combatants,
      position === wildCard.position
        ? { seed: wildCard.seed, slotId: wildCardSlotId }
        : undefined,
      addCombatant,
    ),
  )

  const wildCardId = randomUUID()
  return {
    bracketId,
    battles: listBattles().map(battle => ({ id: randomUUID(), ...battle })),
    divisions: divisionRows,
    seedSlots,
    wildCard: { id: wildCardId, bracketId, seedSlotId: wildCardSlotId },
    wildCardEntrants: wildCard.entrants.map((name, index) => ({
      wildCardId,
      index,
      combatantId: addCombatant(name),
    })),
    combatants,
  }
}

// A division's seed slots in seed order. The wild card's seed takes its
// combatant from the wild card, so the slot holds none
const buildSeedSlots = (
  divisionId: string,
  combatants: string[],
  wildCard: { seed: Seed; slotId: string } | undefined,
  addCombatant: (name: string) => string,
) => {
  const remaining = [...combatants]
  return SEEDS.map(seed =>
    seed === wildCard?.seed
      ? { id: wildCard.slotId, divisionId, seed, combatantId: null }
      : {
          id: randomUUID(),
          divisionId,
          seed,
          // The input schema checks each division's count
          combatantId: addCombatant(remaining.shift()!),
        },
  )
}
