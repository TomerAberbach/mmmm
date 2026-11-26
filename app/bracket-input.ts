import { z } from 'zod'
import {
  DIVISION_POSITIONS,
  DivisionPosition,
  isSameSeedSlot,
  mapDivisions,
  MAX_WILD_CARD_ENTRANTS,
  MIN_WILD_CARD_ENTRANTS,
  POSITION_LABELS,
  readSeedsWithCombatants,
  SEEDS,
} from './bracket.ts'
import type { Seed, SeedSlotRef } from './bracket.ts'
import { COMBATANT_NAME, DIVISION_NAME } from './free-text.ts'

/**
 * Admins enter these names from ASU's published bracket, so they skip the
 * offensive word filter, which flags real combatants such as the Great Tit.
 * `listNameProblems` checks each name, so its message can give the name's
 * place
 */
const nameSchema = z.string().trim()

/**
 * Each division lists its combatants in seed order. The wild card's division
 * skips the wild card's seed, which its winner fills
 */
export type BracketInput<Combatant = string> = {
  divisions: Record<DivisionPosition, { name: string; combatants: Combatant[] }>
  wildCard: { position: DivisionPosition; seed: Seed; entrants: Combatant[] }
}

/**
 * Checks that a bracket whose combatants match `combatantSchema` is whole. It
 * checks no names, so a stored bracket stays readable when a name rule changes
 */
export const toBracketSchema = <Combatant>(
  combatantSchema: z.ZodType<Combatant>,
): z.ZodType<BracketInput<Combatant>> =>
  z
    .object({
      divisions: z.record(
        z.enum(DivisionPosition),
        z.object({
          name: nameSchema,
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
      for (const message of listCountProblems(bracket)) {
        // Names wait for the counts, since their messages give each
        // combatant's seed
        ctx.addIssue({ code: `custom`, message, continue: false })
      }
    })

export const bracketInputSchema = toBracketSchema(nameSchema).superRefine(
  (input, ctx) => {
    for (const { message } of listNameProblems(input)) {
      ctx.addIssue({ code: `custom`, message })
    }
  },
)

/**
 * The wild card's seed slot has no combatant, since the wild card's winner
 * fills it
 */
type SeedSlot<Combatant> = SeedSlotRef & { combatant?: Combatant }

/** A division's seed slots in seed order */
export const listDivisionSeedSlots = <Combatant>(
  { divisions, wildCard }: BracketInput<Combatant>,
  position: DivisionPosition,
): SeedSlot<Combatant>[] => {
  const combatants = [...divisions[position].combatants]
  return SEEDS.map(seed =>
    isSameSeedSlot({ position, seed }, wildCard)
      ? { position, seed }
      : // The input schema checks each division's count
        { position, seed, combatant: combatants.shift()! },
  )
}

export const listSeedSlots = <Combatant>(
  bracket: BracketInput<Combatant>,
): SeedSlot<Combatant>[] =>
  DIVISION_POSITIONS.flatMap(position =>
    listDivisionSeedSlots(bracket, position),
  )

export const mapCombatants = <From, To>(
  { divisions, wildCard }: BracketInput<From>,
  toCombatant: (combatant: From) => To,
): BracketInput<To> => ({
  divisions: mapDivisions(position => ({
    name: divisions[position].name,
    combatants: divisions[position].combatants.map(toCombatant),
  })),
  wildCard: { ...wildCard, entrants: wildCard.entrants.map(toCombatant) },
})

export const toNames = (
  bracket: BracketInput<{ name: string }>,
): BracketInput => mapCombatants(bracket, ({ name }) => name)

/** Where a combatant's name is entered */
export type CombatantPlace =
  | { kind: `seedSlot`; seedSlot: SeedSlotRef }
  | { kind: `entrant`; index: number }

export type NamePlace =
  CombatantPlace | { kind: `divisionName`; position: DivisionPosition }

/** Every seed slot needs one combatant except the wild card's */
const listCountProblems = ({
  divisions,
  wildCard,
}: BracketInput<unknown>): string[] =>
  DIVISION_POSITIONS.flatMap(position => {
    const { name, combatants } = divisions[position]
    const expected = readSeedsWithCombatants(position, wildCard).length
    return combatants.length === expected
      ? []
      : `Give ${name} ${expected} combatants`
  })

/**
 * A name in the bracket. `label` names its place in messages, such as "seed
 * 9 in Tuxedo Style"
 */
type NameField = {
  kind: `division` | `combatant`
  place: NamePlace
  name: string
  label: string
}

const NAME_RULES = {
  division: {
    maxLength: DIVISION_NAME.maxLength,
    tooLong: ({ label }: NameField, maxLength: number) =>
      `Shorten ${label}’s name to ${maxLength} characters or fewer`,
    duplicate: ({ name }: NameField, other: NameField) =>
      `${name} is also ${other.label}’s name. Give each division its own name`,
  },
  combatant: {
    maxLength: COMBATANT_NAME.maxLength,
    tooLong: ({ label }: NameField, maxLength: number) =>
      `Shorten the name of ${label} to ${maxLength} characters or fewer`,
    duplicate: ({ name }: NameField, other: NameField) =>
      `${name} is also ${other.label}. Give each combatant its own name`,
  },
}

/** At most one problem per name, in the order the setup form shows the names */
export const listNameProblems = (
  input: BracketInput,
): { place: NamePlace; message: string }[] => {
  const fields = listNameFields(input)
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
  return fields.flatMap(field => {
    const message = readNameMessage(field, otherByField.get(field))
    return message === undefined ? [] : { place: field.place, message }
  })
}

const readNameMessage = (
  field: NameField,
  other: NameField | undefined,
): string | undefined => {
  if (!field.name) {
    return `Enter a name for ${field.label}`
  }
  const rule = NAME_RULES[field.kind]
  return field.name.length > rule.maxLength
    ? rule.tooLong(field, rule.maxLength)
    : other && rule.duplicate(field, other)
}

/**
 * Each division's name, then its seeds, with the wild card's entrants at its
 * seed
 */
const listNameFields = (input: BracketInput): NameField[] =>
  DIVISION_POSITIONS.flatMap((position): NameField[] => {
    const division = input.divisions[position]
    const divisionLabel = `the ${POSITION_LABELS[position]} division`
    return [
      {
        kind: `division`,
        place: { kind: `divisionName`, position },
        name: division.name,
        label: divisionLabel,
      },
      ...listDivisionSeedSlots(input, position).flatMap(
        ({ seed, combatant }): NameField | NameField[] =>
          combatant === undefined
            ? input.wildCard.entrants.map((name, index) => ({
                kind: `combatant`,
                place: { kind: `entrant`, index },
                name,
                label: `wild card entrant ${index + 1}`,
              }))
            : {
                kind: `combatant`,
                place: { kind: `seedSlot`, seedSlot: { position, seed } },
                name: combatant,
                label: `seed ${seed} in ${division.name || divisionLabel}`,
              },
      ),
    ]
  })

/**
 * Each place whose name another place shares, with the first other place that
 * shares it
 */
const findDuplicateNames = <Place>(
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

export const describeTakenName = (name: string): string =>
  `${name} is already a combatant. Give each combatant its own name`

/**
 * Names differing only in case, spacing, or the style of apostrophe count as
 * the same
 */
export const isSameName = (name: string, other: string): boolean =>
  normalizeName(name) === normalizeName(other)

const normalizeName = (name: string): string =>
  name.trim().toLowerCase().replaceAll(/\s+/gu, ` `).replaceAll(`’`, `'`)
