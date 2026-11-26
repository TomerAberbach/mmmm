import { z } from 'zod'
import { listDivisionSeedSlots, listNameProblems } from './bracket-input.ts'
import type {
  BracketInput,
  CombatantPlace,
  NamePlace,
} from './bracket-input.ts'
import {
  DIVISION_POSITIONS,
  DivisionPosition,
  mapDivisions,
  MAX_WILD_CARD_ENTRANTS,
  MIN_WILD_CARD_ENTRANTS,
  readSeedsWithCombatants,
  SEEDS,
} from './bracket.ts'
import type { SeedSlotRef } from './bracket.ts'
import { formatCount } from './format-count.ts'

const optionalName = z.string().trim().optional()

/**
 * One field per seed, so each name keeps its seed when the admin moves the
 * wild card. The wild card's seed has no field of its own, and only the first
 * `entrantCount` entrants count. The names' messages come from
 * `listNameProblems`
 */
export const bracketFormSchema = z
  .object({
    wildCard: z.object({
      position: z.enum(DivisionPosition, {
        error: `Choose the wild card’s division`,
      }),
      seed: z.literal(SEEDS, { error: `Choose the wild card’s seed` }),
      entrantCount: z
        .number({ error: `Choose how many entrants the wild card has` })
        .int()
        .min(MIN_WILD_CARD_ENTRANTS)
        .max(MAX_WILD_CARD_ENTRANTS),
      entrants: z.array(optionalName).default([]),
    }),
    divisions: z.record(
      z.enum(DivisionPosition),
      z.object({
        name: optionalName,
        seeds: z.array(optionalName).default([]),
      }),
    ),
  })
  .superRefine((form, ctx) => {
    for (const { place, message } of listNameProblems(toBracketInput(form))) {
      ctx.addIssue({ code: `custom`, path: readPath(place), message })
    }
  })

export type BracketForm = z.output<typeof bracketFormSchema>

export type WildCardChoice = SeedSlotRef & { entrantCount: number }

type Path = (string | number)[]

const readPath = (place: NamePlace): Path => {
  switch (place.kind) {
    case `divisionName`:
      return [`divisions`, place.position, `name`]
    case `seedSlot`:
      return [
        `divisions`,
        place.seedSlot.position,
        `seeds`,
        place.seedSlot.seed - 1,
      ]
    case `entrant`:
      return [`wildCard`, `entrants`, place.index]
  }
}

/** A path as Conform names the field, such as `divisions.TOP_LEFT.seeds[0]` */
const formatFieldName = (path: Path): string =>
  path
    .map((part, index) => {
      if (typeof part === `number`) {
        return `[${part}]`
      }
      return index === 0 ? part : `.${part}`
    })
    .join(``)

export const readFieldName = (place: CombatantPlace): string =>
  formatFieldName(readPath(place))

export const readDivisionNameField = (position: DivisionPosition): string =>
  formatFieldName(readPath({ kind: `divisionName`, position }))

/**
 * Every place a combatant's name goes, in paste order: each division's seeds
 * but the wild card's, division by division, then the wild card's entrants
 */
const listCombatantPlaces = (wildCard: WildCardChoice): CombatantPlace[] => [
  ...DIVISION_POSITIONS.flatMap(position =>
    readSeedsWithCombatants(position, wildCard).map(seed => ({
      kind: `seedSlot` as const,
      seedSlot: { position, seed },
    })),
  ),
  ...Array.from({ length: wildCard.entrantCount }, (_, index) => ({
    kind: `entrant` as const,
    index,
  })),
]

/** A missing name becomes blank, which `listNameProblems` refuses */
export const toBracketInput = (form: BracketForm): BracketInput => {
  const { wildCard, divisions } = form
  return {
    divisions: mapDivisions(position => ({
      name: readName(divisions[position].name),
      combatants: readSeedsWithCombatants(position, wildCard).map(seed =>
        readName(divisions[position].seeds[seed - 1]),
      ),
    })),
    wildCard: {
      position: wildCard.position,
      seed: wildCard.seed,
      entrants: Array.from({ length: wildCard.entrantCount }, (_, index) =>
        readName(wildCard.entrants[index]),
      ),
    },
  }
}

const readName = (name: string | undefined): string => name ?? ``

export const toBracketForm = (input: BracketInput): BracketForm => ({
  wildCard: {
    ...input.wildCard,
    entrants: [...input.wildCard.entrants],
    entrantCount: input.wildCard.entrants.length,
  },
  divisions: mapDivisions(position => ({
    name: input.divisions[position].name,
    seeds: listDivisionSeedSlots(input, position).map(
      ({ combatant }) => combatant ?? ``,
    ),
  })),
})

export const countCombatantPlaces = (wildCard: WildCardChoice): number =>
  listCombatantPlaces(wildCard).length

/**
 * The field each pasted name fills, in the order `listCombatantPlaces` gives.
 * Blank lines don't count
 */
export const readPastedNames = (
  text: string,
  wildCard: WildCardChoice,
): { fields: [string, string][] } | { error: string } => {
  const names = text
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean)
  const fieldNames = listCombatantPlaces(wildCard).map(readFieldName)
  if (names.length !== fieldNames.length) {
    const seedCount = fieldNames.length - wildCard.entrantCount
    return {
      error: `Found ${formatCount(names.length, `name`)}. Paste ${fieldNames.length}: the ${seedCount} seeds and the ${wildCard.entrantCount} wild card entrants`,
    }
  }
  return {
    fields: fieldNames.map((fieldName, index) => [fieldName, names[index]!]),
  }
}
