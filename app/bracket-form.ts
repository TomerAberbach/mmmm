import { z } from 'zod'
import { findDuplicateNames, listSeedSlotNames } from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'
import {
  DIVISION_POSITIONS,
  DivisionPosition,
  isSameSeedSlot,
  MAX_WILD_CARD_ENTRANTS,
  MIN_WILD_CARD_ENTRANTS,
  SEEDS,
} from './bracket.ts'
import type { SeedSlotRef } from './bracket.ts'
import { COMBATANT_NAME, DIVISION_NAME } from './free-text.ts'

// Where a combatant's name is entered
type CombatantPlace =
  | { kind: `seedSlot`; seedSlot: SeedSlotRef }
  | { kind: `entrant`; index: number }

export const POSITION_LABELS: Record<DivisionPosition, string> = {
  TOP_LEFT: `top left`,
  BOTTOM_LEFT: `bottom left`,
  TOP_RIGHT: `top right`,
  BOTTOM_RIGHT: `bottom right`,
}

const optionalName = z.string().optional()

// One field per seed, so each name keeps its seed when the admin moves the
// wild card. The wild card's seed has no field of its own, and only the first
// `entrantCount` entrants count
export const bracketFormSchema = z
  .object({
    wildCard: z.object({
      position: z.enum(DivisionPosition, {
        error: `Choose the wild card's division`,
      }),
      seed: z.literal(SEEDS, { error: `Choose the wild card's seed` }),
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
    for (const { path, message } of listProblems(form)) {
      ctx.addIssue({ code: `custom`, path, message })
    }
  })

export type BracketForm = z.output<typeof bracketFormSchema>

export type WildCardChoice = SeedSlotRef & { entrantCount: number }

type Path = (string | number)[]

type Problem = { path: Path; message: string }

// A field holding a name. `label` names it in messages, such as "seed 9 in
// Tuxedo Style"
type NameField = {
  kind: `division` | `combatant`
  path: Path
  name: string
  label: string
}

const RULES = {
  division: {
    maxLength: DIVISION_NAME.maxLength,
    tooLong: ({ label }: NameField) =>
      `Shorten ${label}'s name to ${DIVISION_NAME.maxLength} characters or fewer`,
    duplicate: ({ name }: NameField, other: NameField) =>
      `${name} is also ${other.label}'s name. Give each division its own name`,
  },
  combatant: {
    maxLength: COMBATANT_NAME.maxLength,
    tooLong: ({ label }: NameField) =>
      `Shorten the name of ${label} to ${COMBATANT_NAME.maxLength} characters or fewer`,
    duplicate: ({ name }: NameField, other: NameField) =>
      `${name} is also ${other.label}. Give each combatant its own name`,
  },
}

// At most one problem per field, in the order the form shows the fields
const listProblems = (form: BracketForm): Problem[] => {
  const fields = listNameFields(form)
  const findDuplicates = (kind: NameField[`kind`]) =>
    findDuplicateNames(
      fields
        .filter(field => field.kind === kind && field.name)
        .map(field => ({ place: field, name: field.name })),
    )
  const otherByField = new Map(
    [...findDuplicates(`division`), ...findDuplicates(`combatant`)].map(
      ({ place, other }) => [place, other],
    ),
  )
  return fields
    .map(field => ({
      path: field.path,
      message: readMessage(field, otherByField.get(field)),
    }))
    .filter((problem): problem is Problem => problem.message !== undefined)
}

const readMessage = (
  field: NameField,
  other: NameField | undefined,
): string | undefined => {
  if (!field.name) {
    return `Enter a name for ${field.label}`
  }
  const rule = RULES[field.kind]
  return field.name.length > rule.maxLength
    ? rule.tooLong(field)
    : other && rule.duplicate(field, other)
}

// Each division's name, then its seeds, with the wild card's entrants at its
// seed
const listNameFields = (form: BracketForm): NameField[] =>
  DIVISION_POSITIONS.flatMap(position => {
    const divisionName = form.divisions[position].name?.trim() ?? ``
    const divisionLabel = `the ${POSITION_LABELS[position]} division`
    const combatantField = (place: CombatantPlace, label: string) => ({
      kind: `combatant` as const,
      path: readPath(place),
      name: readCombatantName(form, place),
      label,
    })
    return [
      {
        kind: `division` as const,
        path: [`divisions`, position, `name`],
        name: divisionName,
        label: divisionLabel,
      },
      ...SEEDS.flatMap(seed =>
        isSameSeedSlot({ position, seed }, form.wildCard)
          ? Array.from({ length: form.wildCard.entrantCount }, (_, index) =>
              combatantField(
                { kind: `entrant`, index },
                `wild card entrant ${index + 1}`,
              ),
            )
          : combatantField(
              { kind: `seedSlot`, seedSlot: { position, seed } },
              `seed ${seed} in ${divisionName || divisionLabel}`,
            ),
      ),
    ]
  })

const readCombatantName = (form: BracketForm, place: CombatantPlace): string =>
  (place.kind === `seedSlot`
    ? form.divisions[place.seedSlot.position].seeds[place.seedSlot.seed - 1]
    : form.wildCard.entrants[place.index]
  )?.trim() ?? ``

const readPath = (place: CombatantPlace): Path =>
  place.kind === `seedSlot`
    ? [`divisions`, place.seedSlot.position, `seeds`, place.seedSlot.seed - 1]
    : [`wildCard`, `entrants`, place.index]

// A path as Conform names the field, such as `divisions.TOP_LEFT.seeds[0]`
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
  formatFieldName([`divisions`, position, `name`])

// Every place a combatant's name goes, in paste order: each division's seeds
// but the wild card's, division by division, then the wild card's entrants
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

const readSeedsWithCombatants = (
  position: DivisionPosition,
  wildCard: SeedSlotRef,
) => SEEDS.filter(seed => !isSameSeedSlot({ position, seed }, wildCard))

// Assumes `bracketFormSchema` accepted the form, so every name is present
export const toBracketInput = (form: BracketForm): BracketInput => {
  const { wildCard, divisions } = form
  return {
    divisions: Object.fromEntries(
      DIVISION_POSITIONS.map(position => [
        position,
        {
          name: divisions[position].name!.trim(),
          combatants: readSeedsWithCombatants(position, wildCard).map(seed =>
            divisions[position].seeds[seed - 1]!.trim(),
          ),
        },
      ]),
    ) as BracketInput[`divisions`],
    wildCard: {
      position: wildCard.position,
      seed: wildCard.seed,
      entrants: wildCard.entrants
        .slice(0, wildCard.entrantCount)
        .map(name => name!.trim()),
    },
  }
}

export const toBracketForm = (input: BracketInput): BracketForm => {
  const seedSlotNames = listSeedSlotNames(input)
  return {
    wildCard: {
      ...input.wildCard,
      entrants: [...input.wildCard.entrants],
      entrantCount: input.wildCard.entrants.length,
    },
    divisions: Object.fromEntries(
      DIVISION_POSITIONS.map(position => [
        position,
        {
          name: input.divisions[position].name,
          seeds: seedSlotNames
            .filter(seedSlot => seedSlot.position === position)
            .map(({ name }) => name ?? ``),
        },
      ]),
    ) as BracketForm[`divisions`],
  }
}

export const countCombatantPlaces = (wildCard: WildCardChoice): number =>
  listCombatantPlaces(wildCard).length

// The field each pasted name fills, in the order `listCombatantPlaces` gives.
// Blank lines don't count
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
      error: `Found ${names.length} ${names.length === 1 ? `name` : `names`}. Paste ${fieldNames.length}: the ${seedCount} seeds and the ${wildCard.entrantCount} wild card entrants`,
    }
  }
  return {
    fields: fieldNames.map((fieldName, index) => [fieldName, names[index]!]),
  }
}
