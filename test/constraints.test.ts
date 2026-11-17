import { beforeAll, expect, test } from 'vitest'
import { prisma } from '../app/db.server.ts'
import { BRACKET_2026 } from '../prisma/brackets.ts'
import { createClaimedBracket } from './years.ts'

// Every write here is refused, so the tests share one bracket
const createTestBracket = async () =>
  prisma.bracket.findUniqueOrThrow({
    where: { id: await createClaimedBracket(BRACKET_2026) },
    select: {
      id: true,
      wildCard: { select: { entrants: { take: 1 } } },
      divisions: {
        take: 1,
        select: {
          id: true,
          seedSlots: { where: { combatantId: { not: null } }, take: 1 },
        },
      },
    },
  })

type TestBracket = Awaited<ReturnType<typeof createTestBracket>>

let bracket: TestBracket
beforeAll(async () => {
  bracket = await createTestBracket()
})

test.each([
  {
    scenario: `a seed slot past seed 16`,
    write: ({ divisions }: TestBracket) =>
      prisma.seedSlot.update({
        where: { id: divisions[0]?.seedSlots[0]?.id },
        data: { seed: 17 },
      }),
  },
  {
    scenario: `a fifth wild card entrant`,
    write: ({ wildCard }: TestBracket) => {
      const entrant = wildCard?.entrants[0]
      return prisma.wildCardEntrant.update({
        where: {
          wildCardId_index: {
            wildCardId: entrant?.wildCardId ?? ``,
            index: entrant?.index ?? 0,
          },
        },
        data: { index: 4 },
      })
    },
  },
  {
    scenario: `a blank division name`,
    write: ({ divisions }: TestBracket) =>
      prisma.division.update({
        where: { id: divisions[0]?.id },
        data: { name: ` ` },
      }),
  },
  {
    scenario: `a combatant name past 80 characters`,
    write: ({ divisions }: TestBracket) =>
      prisma.combatant.update({
        where: { id: divisions[0]?.seedSlots[0]?.combatantId ?? `` },
        data: { name: `a`.repeat(81) },
      }),
  },
  {
    scenario: `a 33rd Round 1 battle`,
    write: ({ id }: TestBracket) =>
      prisma.battle.create({
        data: {
          id: crypto.randomUUID(),
          bracketId: id,
          round: `ROUND_1`,
          index: 32,
        },
      }),
  },
])(`the database refuses $scenario`, async ({ write }) => {
  const writing = write(bracket)

  await expect(writing).rejects.toThrow(/violates check constraint/u)
})
