import { listSeedSlots } from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'
import {
  mapDivisions,
  readBattleSides,
  toBattleKey,
  toSeedSlotKey,
} from './bracket.ts'
import type {
  BattleRef,
  DivisionPosition,
  Seed,
  SeedSlotRef,
  Winners,
} from './bracket.ts'

type StoredCombatant = { id: string; name: string }

/** Two sides that advance together under a combined name */
export type StoredMerge = StoredCombatant & { memberIds: string[] }

/** A saved bracket's names with their combatants' row IDs */
export type StoredBracket = BracketInput<StoredCombatant> & {
  merges: StoredMerge[]
}

/** A merge's winner has its best member's seed */
export type Combatant = StoredCombatant & {
  seed: Seed
  merge?: {
    memberIds: string[]
    /** The combatants before any merge that the merge's winner stands for */
    originalIds: string[]
  }
}

/**
 * A stored bracket with each seed slot's combatant and each combatant's seed
 * looked up, for filling battles' sides
 */
export type SeededBracket = {
  divisionNames: Record<DivisionPosition, string>
  wildCardSlot: SeedSlotRef
  wildCardEntrants: readonly Combatant[]
  /** Keyed by `toSeedSlotKey`. The wild card's seed slot has no combatant */
  combatantBySeedSlot: ReadonlyMap<string, Combatant>
  combatantById: ReadonlyMap<string, Combatant>
}

export const toSeededBracket = (stored: StoredBracket): SeededBracket => {
  const { divisions, wildCard } = stored
  const seedSlots = listSeedSlots(stored).flatMap(({ combatant, ...slot }) =>
    combatant === undefined
      ? []
      : { slot, combatant: { ...combatant, seed: slot.seed } },
  )
  const wildCardEntrants = wildCard.entrants.map(entrant => ({
    ...entrant,
    seed: wildCard.seed,
  }))
  const bracket: SeededBracket = {
    divisionNames: mapDivisions(position => divisions[position].name),
    wildCardSlot: { position: wildCard.position, seed: wildCard.seed },
    wildCardEntrants,
    combatantBySeedSlot: new Map(
      seedSlots.map(({ slot, combatant }) => [toSeedSlotKey(slot), combatant]),
    ),
    combatantById: new Map(
      [...seedSlots.map(({ combatant }) => combatant), ...wildCardEntrants].map(
        combatant => [combatant.id, combatant],
      ),
    ),
  }
  // A merge can have another merge as a member, whichever was read first
  const addMerge = (
    seeded: SeededBracket,
    merge: StoredMerge,
  ): SeededBracket =>
    seeded.combatantById.has(merge.id)
      ? seeded
      : withMerge(
          stored.merges
            .filter(({ id }) => merge.memberIds.includes(id))
            .reduce(addMerge, seeded),
          merge,
        )
  return stored.merges.reduce(addMerge, bracket)
}

/** Adds a merge whose members are in the bracket */
export const withMerge = (
  bracket: SeededBracket,
  merge: StoredMerge,
): SeededBracket => {
  const [seed] = merge.memberIds
    .map(id => bracket.combatantById.get(id)!.seed)
    .toSorted((first, second) => first - second)
  return {
    ...bracket,
    combatantById: new Map([
      ...bracket.combatantById,
      [
        merge.id,
        {
          id: merge.id,
          name: merge.name,
          seed: seed!,
          merge: {
            memberIds: merge.memberIds,
            originalIds: merge.memberIds.flatMap(id =>
              listOriginalIds(bracket, id),
            ),
          },
        },
      ],
    ]),
  }
}

/** Every combatant, with the winners of merges */
export const listCombatants = ({ combatantById }: SeededBracket): Combatant[] =>
  Array.from(combatantById, ([, combatant]) => combatant)

/** The winners of merges */
export const listMerges = (bracket: SeededBracket): Combatant[] =>
  listCombatants(bracket).filter(({ merge }) => merge)

/** The combatants before any merge, by ID, that `id` stands for */
export const listOriginalIds = (bracket: SeededBracket, id: string): string[] =>
  bracket.combatantById.get(id)?.merge?.originalIds ?? [id]

/** Whether the combatant won the battle, alone or in a merge there or before */
export const didAdvance = (
  { id }: Combatant,
  winner: Combatant | undefined,
): boolean =>
  id === winner?.id ||
  (winner?.merge?.memberIds.includes(id) ?? false) ||
  (winner?.merge?.originalIds.includes(id) ?? false)

/**
 * A battle's side once its combatant is known, or the earlier battle whose
 * winner fills it
 */
export type Side =
  | { kind: `combatant`; combatant: Combatant }
  | { kind: `undecided`; battle: BattleRef }

/**
 * The battle's sides, filled from the seed slots, the wild card's entrants,
 * and the earlier battles' winners. Each winner must be a combatant in the
 * bracket
 */
export const fillSides = (
  bracket: SeededBracket,
  battle: BattleRef,
  winners: Winners,
): Side[] => {
  const toSide = (combatant: Combatant): Side => ({
    kind: `combatant`,
    combatant,
  })
  if (battle.round === `WILD_CARD`) {
    return bracket.wildCardEntrants.map(toSide)
  }
  return readBattleSides(
    { ...battle, round: battle.round },
    bracket.wildCardSlot,
  ).map(side => {
    if (side.kind === `seedSlot`) {
      // Only the wild card's seed slot has no combatant, and its side is the
      // wild card's winner
      return toSide(
        bracket.combatantBySeedSlot.get(toSeedSlotKey(side.seedSlot))!,
      )
    }
    const winner = winners[toBattleKey(side.battle)]
    return winner === undefined
      ? { kind: `undecided`, battle: side.battle }
      : toSide(bracket.combatantById.get(winner)!)
  })
}

const findCombatant = (
  sides: Side[],
  combatantId: string,
): Combatant | undefined =>
  sides
    .flatMap(side => (side.kind === `combatant` ? side.combatant : []))
    .find(({ id }) => id === combatantId)

/** The winner, as one of the sides or as the merge of both */
export const findWinner = (
  bracket: SeededBracket,
  sides: Side[],
  winnerId: string,
): Combatant | undefined => {
  const winner = bracket.combatantById.get(winnerId)
  const memberIds = winner?.merge?.memberIds
  const isMergeOfSides =
    memberIds !== undefined &&
    sides.every(
      side =>
        side.kind === `combatant` && memberIds.includes(side.combatant.id),
    )
  return isMergeOfSides ? winner : findCombatant(sides, winnerId)
}
