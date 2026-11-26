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

/** A saved bracket's names with their combatants' row IDs */
export type StoredBracket = BracketInput<StoredCombatant>

export type Combatant = StoredCombatant & { seed: Seed }

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
  return {
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
}

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

export const findCombatant = (
  sides: Side[],
  combatantId: string,
): Combatant | undefined =>
  sides
    .flatMap(side => (side.kind === `combatant` ? side.combatant : []))
    .find(({ id }) => id === combatantId)
