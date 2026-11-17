import { z } from 'zod'
import {
  DivisionPosition,
  MAX_WILD_CARD_ENTRANTS,
  MIN_WILD_CARD_ENTRANTS,
  SEEDS,
  SEEDS_PER_DIVISION,
} from './bracket.ts'
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
  input: BracketInput,
  ctx: z.RefinementCtx,
): void => {
  const { divisions, wildCard } = input
  const allDivisions = Object.entries(divisions)
  if (hasDuplicateNames(allDivisions.map(([, { name }]) => name))) {
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
  const combatantNames = [
    ...allDivisions.flatMap(([, { combatants }]) => combatants),
    ...wildCard.entrants,
  ]
  if (hasDuplicateNames(combatantNames)) {
    ctx.addIssue({
      code: `custom`,
      message: `Give each combatant its own name`,
    })
  }
}

export const bracketInputSchema =
  bracketInputShape.superRefine(checkNamesAndCounts)

// Whether any two names count as the same, by the rule `findDuplicateNames`
// uses
const hasDuplicateNames = (names: string[]): boolean =>
  new Set(names.map(normalizeName)).size < names.length

// Each place whose name another place shares, with the first other place that
// shares it. Names differing only in case, spacing, or the style of
// apostrophe count as the same
export const findDuplicateNames = <Place>(
  entries: { place: Place; name: string }[],
): { place: Place; other: Place }[] => {
  const entriesByName = Map.groupBy(entries, ({ name }) => normalizeName(name))
  return entries
    .map(({ place, name }) => ({
      place,
      other: entriesByName
        .get(normalizeName(name))!
        .find(entry => entry.place !== place)?.place,
    }))
    .filter(
      (duplicate): duplicate is { place: Place; other: Place } =>
        duplicate.other !== undefined,
    )
}

const normalizeName = (name: string): string =>
  name.trim().toLowerCase().replaceAll(/\s+/gu, ` `).replaceAll(`’`, `'`)
