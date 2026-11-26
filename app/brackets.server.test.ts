import { expect, test } from 'vitest'
import { ZodError } from 'zod'
import { BRACKET_2017, BRACKET_2025, BRACKET_2026 } from '../prisma/brackets.ts'
import { createContestInNewYear } from '../test/contests.ts'
import { findCombatantId } from '../test/picks.ts'
import { addYear, claimYear } from '../test/years.ts'
import { toNames } from './bracket-input.ts'
import {
  deleteUnpublishedBracket,
  listBracketCombatants,
  readBracket,
  readBracketSummary,
  readCurrentBracket,
  renameCombatant,
  saveUnpublishedBracket,
  setBracketPublished,
  setExpectedLockDate,
} from './brackets.server.ts'
import { prisma } from './db.server.ts'
import { toSeededBracket } from './seeded-bracket.ts'

const readBracketNames = async (year: number) => {
  const bracket = await readBracket(year)
  return bracket && toNames(bracket)
}

/** The combatant in a seed slot, or the wild card's entrants for its slot */
const readSeedSlotNames = async (
  year: number,
  divisionName: string,
  seed: number,
): Promise<string[]> => {
  const { combatant, wildCard } = await prisma.seedSlot.findFirstOrThrow({
    where: { seed, division: { year, name: divisionName } },
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
  const year = await addYear({ published: false, input: BRACKET_2025 })

  const seeds = [
    await readSeedSlotNames(year, `SAME & DIFFERENT`, 13),
    await readSeedSlotNames(year, `SAME & DIFFERENT`, 14),
    await readSeedSlotNames(year, `SAME & DIFFERENT`, 15),
  ]

  expect(seeds).toStrictEqual([
    [BRACKET_2025.divisions.TOP_LEFT.combatants[12]],
    [`Northern Flying Squirrel`, `Flying Frog`],
    [BRACKET_2025.divisions.TOP_LEFT.combatants[13]],
  ])
})

test(`2017's wild card keeps its 4 entrants in order`, async () => {
  const year = await addYear({ published: false, input: BRACKET_2017 })

  const entrants = await readSeedSlotNames(year, `COULDA SHOULDA`, 16)

  expect(entrants).toStrictEqual([
    `Snow Leopard`,
    `Red Giant Flying Squirrel`,
    `Rhesus Macaque`,
    `Fisher`,
  ])
})

test(`a stored bracket has all 64 battles and starts unpublished`, async () => {
  const year = await addYear({ published: false, input: BRACKET_2026 })

  const bracket = await prisma.bracket.findUniqueOrThrow({
    where: { year },
    select: { publishedAt: true, _count: { select: { battles: true } } },
  })

  expect(bracket).toStrictEqual({ publishedAt: null, _count: { battles: 64 } })
})

test(`an admin's names skip the offensive word filter`, async () => {
  const year = await addYear({
    published: false,
    input: {
      ...BRACKET_2026,
      wildCard: {
        ...BRACKET_2026.wildCard,
        entrants: [`Great Tit`, `Assassin Bug`],
      },
    },
  })

  const entrants = await readSeedSlotNames(year, `THAT’S SO METAL`, 16)

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
  const year = await claimYear()

  await expect(saveUnpublishedBracket(year, input)).rejects.toBeInstanceOf(
    ZodError,
  )
})

test(`the current bracket is the newest published one, read back as entered`, async () => {
  await addYear({ published: true })
  const newestPublishedYear = await addYear({
    published: true,
    input: BRACKET_2025,
  })
  await addYear({ published: false })

  const { bracket, ...current } = (await readCurrentBracket())!

  expect(current).toStrictEqual({
    year: newestPublishedYear,
    expectedLockDate: null,
    results: {},
  })
  expect(toNames(bracket)).toStrictEqual(BRACKET_2025)
})

test(`saving an unpublished bracket replaces it`, async () => {
  const year = await claimYear()
  await saveUnpublishedBracket(year, BRACKET_2026)

  await saveUnpublishedBracket(year, BRACKET_2025)

  await expect(readBracketNames(year)).resolves.toStrictEqual(BRACKET_2025)
  await expect(readBracketSummary(year)).resolves.toMatchObject({
    phase: `SETUP`,
  })
})

test(`saving an unpublished bracket keeps its expected lock date`, async () => {
  const year = await claimYear()
  await saveUnpublishedBracket(year, BRACKET_2026)
  const expectedLockDate = new Date(`2027-03-19T00:00:00Z`)
  await setExpectedLockDate(year, expectedLockDate)

  await saveUnpublishedBracket(year, BRACKET_2025)

  await expect(readBracketSummary(year)).resolves.toMatchObject({
    expectedLockDate,
  })
})

test(`an expected lock date set during a save is kept`, async () => {
  const year = await claimYear()
  await saveUnpublishedBracket(year, BRACKET_2026)
  const expectedLockDate = new Date(`2027-03-19T00:00:00Z`)

  const [, wasSet] = await Promise.all([
    saveUnpublishedBracket(year, BRACKET_2025),
    setExpectedLockDate(year, expectedLockDate),
  ])

  expect(wasSet).toBe(true)
  await expect(readBracketSummary(year)).resolves.toMatchObject({
    expectedLockDate,
  })
})

test(`two saves of an unpublished bracket at once both succeed`, async () => {
  const year = await claimYear()
  await saveUnpublishedBracket(year, BRACKET_2026)

  const saved = await Promise.all([
    saveUnpublishedBracket(year, BRACKET_2025),
    saveUnpublishedBracket(year, BRACKET_2025),
  ])

  expect(saved).toStrictEqual([true, true])
  await expect(readBracketNames(year)).resolves.toStrictEqual(BRACKET_2025)
})

test(`saving over a published bracket changes nothing`, async () => {
  const year = await addYear({ published: true, input: BRACKET_2026 })

  const saved = await saveUnpublishedBracket(year, BRACKET_2025)

  expect(saved).toBe(false)
  await expect(readBracketNames(year)).resolves.toStrictEqual(BRACKET_2026)
  await expect(readBracketSummary(year)).resolves.toMatchObject({
    phase: `OPEN`,
  })
})

test(`deleting an unpublished bracket removes it`, async () => {
  const year = await claimYear()
  await saveUnpublishedBracket(year, BRACKET_2026)

  const deleted = await deleteUnpublishedBracket(year)

  expect(deleted).toBe(true)
  await expect(readBracket(year)).resolves.toBeNull()
})

test(`deleting a published bracket leaves it`, async () => {
  const year = await addYear({ published: true, input: BRACKET_2026 })

  const deleted = await deleteUnpublishedBracket(year)

  expect(deleted).toBe(false)
  await expect(readBracket(year)).resolves.not.toBeNull()
})

test(`a combatant in a seed slot can't be deleted on its own`, async () => {
  const year = await addYear({ published: false, input: BRACKET_2026 })
  const { combatantId } = await prisma.seedSlot.findFirstOrThrow({
    where: { division: { year }, combatantId: { not: null } },
    select: { combatantId: true },
  })

  await expect(
    prisma.combatant.delete({ where: { id: combatantId! } }),
  ).rejects.toMatchObject({ code: `P2003` })
})

test.each([
  {
    scenario: `publishing an unpublished bracket`,
    from: false,
    to: true,
    change: `CHANGED`,
  },
  {
    scenario: `publishing a published bracket`,
    from: true,
    to: true,
    change: `UNCHANGED`,
  },
  {
    scenario: `unpublishing a published bracket`,
    from: true,
    to: false,
    change: `CHANGED`,
  },
  {
    scenario: `unpublishing an unpublished bracket`,
    from: false,
    to: false,
    change: `UNCHANGED`,
  },
])(`$scenario reports whether it changed it`, async ({ from, to, change }) => {
  // A current year without a champion would keep this one unpublished
  await prisma.bracket.updateMany({ data: { publishedAt: null } })
  const year = await addYear({ published: from, input: BRACKET_2026 })

  const result = await setBracketPublished(year, to)

  expect(result).toBe(change)
})

test(`a bracket with a contest stays published`, async () => {
  const { year } = await createContestInNewYear()

  const result = await setBracketPublished(year, false)

  expect(result).toBe(`HAS_CONTESTS`)
  await expect(readBracketSummary(year)).resolves.toMatchObject({
    phase: `OPEN`,
  })
})

test(`a bracket with a contest can't be deleted`, async () => {
  const { year } = await createContestInNewYear()

  const deleting = prisma.bracket.delete({ where: { year } })

  await expect(deleting).rejects.toMatchObject({ code: `P2003` })
  await expect(readBracket(year)).resolves.not.toBeNull()
})

test(`an unpublished bracket is no longer current`, async () => {
  const year = await addYear({ published: true })

  await setBracketPublished(year, false)

  await expect(readCurrentBracket()).resolves.not.toMatchObject({ year })
})

test(`the current bracket carries its expected lock date`, async () => {
  const year = await addYear({ published: true })
  const expectedLockDate = new Date(`2099-03-19T00:00:00Z`)

  await setExpectedLockDate(year, expectedLockDate)

  await expect(readCurrentBracket()).resolves.toMatchObject({
    year,
    expectedLockDate,
  })
})

test(`the wild card's entrants are listed at its seed`, async () => {
  const year = await addYear({ published: false, input: BRACKET_2025 })

  const divisions = listBracketCombatants((await readBracket(year))!)

  expect(
    divisions[0]?.combatants.filter(({ seed }) => seed === 14),
  ).toMatchObject([
    { name: `Northern Flying Squirrel`, isWildCardEntrant: true },
    { name: `Flying Frog`, isWildCardEntrant: true },
  ])
})

const readCombatantId = async (year: number, name: string) =>
  findCombatantId(toSeededBracket((await readBracket(year))!), name)

test(`renaming a combatant changes its name everywhere the bracket shows it`, async () => {
  const year = await addYear({ published: true, input: BRACKET_2025 })
  const id = await readCombatantId(year, `Gelada`)

  const result = await renameCombatant(year, id, `Gelada Baboon`)

  expect(result).toStrictEqual({ ok: true })
  const bracket = await readBracket(year)
  expect(bracket?.divisions.TOP_LEFT.combatants).toContainEqual({
    id,
    name: `Gelada Baboon`,
  })
})

test(`a rename to another combatant's name is refused`, async () => {
  const year = await addYear({ published: true, input: BRACKET_2025 })
  const id = await readCombatantId(year, `Gelada`)

  const result = await renameCombatant(year, id, `sun bear`)

  expect(result).toStrictEqual({
    error: `Sun Bear is already a combatant. Give each combatant its own name`,
  })
})

test(`a combatant from another year can't be renamed`, async () => {
  const year = await addYear({ published: true, input: BRACKET_2025 })
  const otherYear = await addYear({
    published: false,
    input: BRACKET_2026,
  })
  const id = await readCombatantId(otherYear, `Lions`)

  const result = await renameCombatant(year, id, `Lionesses`)

  expect(result).toStrictEqual({
    error: `That combatant isn’t in the ${year} bracket`,
  })
})

test(`a bracket whose combatants share a name still reads`, async () => {
  const year = await addYear({ published: false })
  const [first, second] = await prisma.combatant.findMany({
    where: { year },
    take: 2,
  })
  await prisma.combatant.update({
    where: { id: second!.id },
    data: { name: first!.name.toUpperCase() },
  })

  await expect(readBracket(year)).resolves.not.toBeNull()
})

test.each([true, false])(
  `a past year's publication doesn't change (to published: %s)`,
  async published => {
    const year = await addYear({ published: !published })
    await addYear({ published: true })

    const result = await setBracketPublished(year, published)

    expect(result).toBe(`PAST`)
    const { publishedAt } = await prisma.bracket.findUniqueOrThrow({
      where: { year },
    })
    expect(publishedAt !== null).toBe(!published)
  },
)
