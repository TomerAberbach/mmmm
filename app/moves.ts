import { listSeedSlots, mapCombatants } from './bracket-input.ts'
import { listBattles, ROUND_NAMES, toBattleKey } from './bracket.ts'
import type { BattleRef } from './bracket.ts'
import { fillSides } from './seeded-bracket.ts'
import type { SeededBracket, StoredBracket } from './seeded-bracket.ts'

/** The IDs of two combatants to put in each other's place */
export type Swap = [string, string]

/**
 * The combatants' IDs in order of their places, so two brackets with the same
 * arrangement have the same combatant in every place
 */
export const readArrangement = (bracket: StoredBracket): string =>
  listPlaces(bracket)
    .map(({ combatant }) => combatant.id)
    .join(` `)

/** A place in the bracket, with the combatant in it */
export type Place = {
  /** Such as "Tuxedo Style 3" */
  label: string
  combatant: { id: string; name: string }
}

export const listPlaces = (bracket: StoredBracket): Place[] => [
  ...listSeedSlots(bracket).flatMap(({ position, seed, combatant }) =>
    combatant
      ? { label: `${bracket.divisions[position].name} ${seed}`, combatant }
      : [],
  ),
  ...bracket.wildCard.entrants.map(combatant => ({
    label: ROUND_NAMES.WILD_CARD,
    combatant,
  })),
]

/**
 * Makes each swap in order. Null when one names a combatant that has no place
 */
export const swapCombatants = (
  bracket: StoredBracket,
  swaps: readonly Swap[],
): StoredBracket | null => {
  const combatantById = new Map(
    listPlaces(bracket).map(({ combatant }) => [combatant.id, combatant]),
  )
  if (swaps.flat().some(id => !combatantById.has(id))) {
    return null
  }
  return swaps.reduce<StoredBracket>(
    (swapped, [first, second]) => ({
      ...mapCombatants(swapped, combatant => {
        switch (combatant.id) {
          case first:
            return combatantById.get(second)!
          case second:
            return combatantById.get(first)!
          default:
            return combatant
        }
      }),
      merges: bracket.merges,
    }),
    bracket,
  )
}

/**
 * The battles where a move makes different combatants meet, with every later
 * battle their winners reach. Picks and results there no longer stand, whoever
 * made them, while those of any other battle do
 */
export const listDisturbedBattles = (
  before: SeededBracket,
  after: SeededBracket,
): BattleRef[] => {
  const disturbedKeys = new Set<string>()
  return listBattles().filter(battle => {
    const isDisturbed =
      fillSides(before, battle, {}).some(
        side =>
          side.kind === `undecided` &&
          disturbedKeys.has(toBattleKey(side.battle)),
      ) || listStarterIds(before, battle) !== listStarterIds(after, battle)
    if (isDisturbed) {
      disturbedKeys.add(toBattleKey(battle))
    }
    return isDisturbed
  })
}

/** The IDs of the combatants who start in the battle, in no one side's order */
const listStarterIds = (bracket: SeededBracket, battle: BattleRef): string =>
  fillSides(bracket, battle, {})
    .flatMap(side => (side.kind === `combatant` ? side.combatant.id : []))
    .toSorted()
    .join(` `)
