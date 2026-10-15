import { expect, test } from 'vitest'
import { ZodError } from 'zod'
import { BRACKET_2017, BRACKET_2025, BRACKET_2026 } from '../prisma/brackets.ts'
import type { BracketInput } from './bracket-input.ts'
import { createBracket } from './brackets.server.ts'
import { prisma } from './db.server.ts'

// The test database is shared across this run, and each year holds one
// bracket, so each test stores its bracket under a year of its own
let nextYear = 3000
const createInNewYear = (input: BracketInput) =>
  createBracket(nextYear++, input)

// The combatant in a seed slot, or the wild card's entrants for its slot
const readSeedSlotNames = async (
  bracketId: string,
  divisionName: string,
  seed: number,
): Promise<string[]> => {
  const { combatant, wildCard } = await prisma.seedSlot.findFirstOrThrow({
    where: { seed, division: { bracketId, name: divisionName } },
    select: {
      combatant: { select: { name: true } },
      wildCard: {
        select: {
          entrants: {
            orderBy: { index: `asc` },
            select: { combatant: { select: { name: true } } },
          },
        },
      },
    },
  })
  return combatant
    ? [combatant.name]
    : (wildCard?.entrants.map(entrant => entrant.combatant.name) ?? [])
}

test(`2025's wild card fills seed 14, and seed 15 keeps its own combatant`, async () => {
  const bracketId = await createInNewYear(BRACKET_2025)

  const seeds = [
    await readSeedSlotNames(bracketId, `SAME & DIFFERENT`, 13),
    await readSeedSlotNames(bracketId, `SAME & DIFFERENT`, 14),
    await readSeedSlotNames(bracketId, `SAME & DIFFERENT`, 15),
  ]

  expect(seeds).toStrictEqual([
    [BRACKET_2025.divisions.TOP_LEFT.combatants[12]],
    [`Northern Flying Squirrel`, `Flying Frog`],
    [BRACKET_2025.divisions.TOP_LEFT.combatants[13]],
  ])
})

test(`2017's wild card keeps its 4 entrants in order`, async () => {
  const bracketId = await createInNewYear(BRACKET_2017)

  const entrants = await readSeedSlotNames(bracketId, `COULDA SHOULDA`, 16)

  expect(entrants).toStrictEqual([
    `Snow Leopard`,
    `Red Giant Flying Squirrel`,
    `Rhesus Macaque`,
    `Fisher`,
  ])
})

test(`a stored bracket has all 64 battles and starts unpublished`, async () => {
  const bracketId = await createInNewYear(BRACKET_2026)

  const bracket = await prisma.bracket.findUniqueOrThrow({
    where: { id: bracketId },
    select: { publishedAt: true, _count: { select: { battles: true } } },
  })

  expect(bracket).toStrictEqual({ publishedAt: null, _count: { battles: 64 } })
})

test(`an admin's names skip the offensive word filter`, async () => {
  const bracketId = await createInNewYear({
    ...BRACKET_2026,
    wildCard: {
      ...BRACKET_2026.wildCard,
      entrants: [`Great Tit`, `Assassin Bug`],
    },
  })

  const entrants = await readSeedSlotNames(bracketId, `THAT’S SO METAL`, 16)

  expect(entrants).toStrictEqual([`Great Tit`, `Assassin Bug`])
})

test.each([
  {
    scenario: `two combatants differing only in case`,
    input: {
      ...BRACKET_2026,
      wildCard: {
        ...BRACKET_2026.wildCard,
        entrants: [`nile crocodile`, `Assassin Bug`],
      },
    },
  },
  {
    scenario: `a division without a 16 seed`,
    input: {
      ...BRACKET_2026,
      divisions: {
        ...BRACKET_2026.divisions,
        TOP_LEFT: {
          ...BRACKET_2026.divisions.TOP_LEFT,
          combatants: BRACKET_2026.divisions.TOP_LEFT.combatants.slice(0, 15),
        },
      },
    },
  },
  {
    scenario: `the same name with a different apostrophe`,
    input: {
      ...BRACKET_2026,
      wildCard: {
        ...BRACKET_2026.wildCard,
        entrants: [`Assassin Bug`, `Steller's Sea Cow`],
      },
    },
  },
  {
    scenario: `a fifth wild card entrant`,
    input: {
      ...BRACKET_2017,
      wildCard: {
        ...BRACKET_2017.wildCard,
        entrants: [...BRACKET_2017.wildCard.entrants, `Okapi`],
      },
    },
  },
])(`a bracket with $scenario isn't stored`, async ({ input }) => {
  const year = nextYear++

  await expect(createBracket(year, input)).rejects.toBeInstanceOf(ZodError)

  await expect(
    prisma.year.findUnique({ where: { id: year } }),
  ).resolves.toBeNull()
})
