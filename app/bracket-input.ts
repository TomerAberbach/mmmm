import { z } from 'zod'
import {
  DIVISION_POSITIONS,
  DivisionPosition,
  MAX_WILD_CARD_ENTRANTS,
  MIN_WILD_CARD_ENTRANTS,
  SEEDS,
  SEEDS_PER_DIVISION,
} from './bracket.ts'
import type { Seed } from './bracket.ts'
import { COMBATANT_NAME, DIVISION_NAME, freeTextSchema } from './free-text.ts'

// Admins enter these names from ASU's published bracket, so they skip the
// offensive word filter, which flags real combatants such as the Great Tit
const divisionNameSchema = freeTextSchema(DIVISION_NAME)
const combatantNameSchema = freeTextSchema(COMBATANT_NAME)

// Each division lists its combatants in seed order. The wild card's division
// skips the wild card's seed, which its winner fills
export type BracketInput<Combatant = string> = {
  divisions: Record<DivisionPosition, { name: string; combatants: Combatant[] }>
  wildCard: { position: DivisionPosition; seed: Seed; entrants: Combatant[] }
}

// Checks a bracket whose combatants match `combatantSchema`, comparing the
// names `readName` reads
export const toBracketSchema = <Combatant>(
  combatantSchema: z.ZodType<Combatant>,
  readName: (combatant: Combatant) => string,
): z.ZodType<BracketInput<Combatant>> =>
  z
    .object({
      divisions: z.record(
        z.enum(DivisionPosition),
        z.object({
          name: divisionNameSchema,
          combatants: z.array(combatantSchema),
        }),
      ),
      wildCard: z.object({
        position: z.enum(DivisionPosition),
        seed: z.literal(SEEDS),
        entrants: z
          .array(combatantSchema)
          .min(MIN_WILD_CARD_ENTRANTS)
          .max(MAX_WILD_CARD_ENTRANTS),
      }),
    })
    .superRefine((bracket, ctx) => {
      checkNamesAndCounts(mapCombatants(bracket, readName), ctx)
    })

export const bracketInputSchema = toBracketSchema(
  combatantNameSchema,
  name => name,
)

export const mapCombatants = <From, To>(
  { divisions, wildCard }: BracketInput<From>,
  toCombatant: (combatant: From) => To,
): BracketInput<To> => ({
  divisions: Object.fromEntries(
    DIVISION_POSITIONS.map(position => [
      position,
      {
        name: divisions[position].name,
        combatants: divisions[position].combatants.map(toCombatant),
      },
    ]),
  ) as BracketInput<To>[`divisions`],
  wildCard: { ...wildCard, entrants: wildCard.entrants.map(toCombatant) },
})

export const toNames = (
  bracket: BracketInput<{ name: string }>,
): BracketInput => mapCombatants(bracket, ({ name }) => name)

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
