import { z } from 'zod'
import {
  DIVISION_POSITIONS,
  DivisionPosition,
  isSameSeedSlot,
  MAX_WILD_CARD_ENTRANTS,
  MIN_WILD_CARD_ENTRANTS,
  SEEDS,
  SEEDS_PER_DIVISION,
} from './bracket.ts'
import type { SeedSlotRef } from './bracket.ts'
import { COMBATANT_NAME, DIVISION_NAME, freeTextSchema } from './free-text.ts'

// Admins enter these names from ASU's published bracket, so they skip the
// offensive word filter, which flags real combatants such as the Great Tit
const divisionNameSchema = freeTextSchema(DIVISION_NAME)
const combatantNameSchema = freeTextSchema(COMBATANT_NAME)

// Each division lists its combatants in seed order. The wild card's division
// skips the wild card's seed, which its winner fills
const bracketInputShape = z.object({
  divisions: z.record(
    z.enum(DivisionPosition),
    z.object({
      name: divisionNameSchema,
      combatants: z.array(combatantNameSchema),
    }),
  ),
  wildCard: z.object({
    position: z.enum(DivisionPosition),
    seed: z.literal(SEEDS),
    entrants: z
      .array(combatantNameSchema)
      .min(MIN_WILD_CARD_ENTRANTS)
      .max(MAX_WILD_CARD_ENTRANTS),
  }),
})

export type BracketInput = z.output<typeof bracketInputShape>

// Division and combatant names must each be unique, and every seed slot needs
// one combatant except the wild card's
const checkNamesAndCounts = (
  { divisions, wildCard }: BracketInput,
  ctx: z.RefinementCtx,
): void => {
  const allDivisions = Object.entries(divisions)
  if (hasDuplicate(allDivisions.map(([, { name }]) => name))) {
    ctx.addIssue({ code: `custom`, message: `Give each division its own name` })
  }
  for (const [position, { name, combatants }] of allDivisions) {
    const expected =
      position === wildCard.position
        ? SEEDS_PER_DIVISION - 1
        : SEEDS_PER_DIVISION
    if (combatants.length !== expected) {
      ctx.addIssue({
        code: `custom`,
        message: `Give ${name} ${expected} combatants`,
      })
    }
  }
  const names = [
    ...allDivisions.flatMap(([, { combatants }]) => combatants),
    ...wildCard.entrants,
  ]
  if (hasDuplicate(names)) {
    ctx.addIssue({
      code: `custom`,
      message: `Give each combatant its own name`,
    })
  }
}

export const bracketInputSchema =
  bracketInputShape.superRefine(checkNamesAndCounts)

// Names differing only in case, spacing, or the style of apostrophe count as
// the same
const hasDuplicate = (names: string[]): boolean =>
  new Set(names.map(normalizeName)).size < names.length

const normalizeName = (name: string): string =>
  name.toLowerCase().replaceAll(/\s+/gu, ` `).replaceAll(`’`, `'`)

// Every seed slot in seed order, with its combatant's name. The wild card's
// seed slot has none, since the wild card's winner fills it
export const listSeedSlotNames = ({
  divisions,
  wildCard,
}: BracketInput): (SeedSlotRef & { name?: string })[] =>
  DIVISION_POSITIONS.flatMap(position => {
    const names = [...divisions[position].combatants]
    return SEEDS.map(seed =>
      isSameSeedSlot({ position, seed }, wildCard)
        ? { position, seed }
        : // The input schema checks each division's count
          { position, seed, name: names.shift()! },
    )
  })
