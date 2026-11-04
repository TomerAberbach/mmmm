import type { BracketInput } from './bracket-input.ts'
import {
  DIVISION_POSITIONS,
  isSameSeedSlot,
  readBattleSides,
  SEEDS,
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

// A bracket input with each seed slot's combatant and each combatant's seed
// looked up, for filling battles' sides
export type SeededBracket = {
  divisionNames: Record<DivisionPosition, string>
  wildCardSlot: SeedSlotRef
  wildCardEntrants: readonly string[]
  // Keyed by `toSeedSlotKey`. The wild card's seed slot has no combatant
  nameBySeedSlot: ReadonlyMap<string, string>
  // Every wild card entrant has the wild card's seed
  seedByName: ReadonlyMap<string, Seed>
}

export const toSeededBracket = (input: BracketInput): SeededBracket => {
  const { divisions, wildCard } = input
  const seedSlotNames = listSeedSlotNames(input).filter(
    (slot): slot is SeedSlotRef & { name: string } => slot.name !== undefined,
  )
  return {
    divisionNames: Object.fromEntries(
      DIVISION_POSITIONS.map(position => [position, divisions[position].name]),
    ) as Record<DivisionPosition, string>,
    wildCardSlot: { position: wildCard.position, seed: wildCard.seed },
    wildCardEntrants: wildCard.entrants,
    nameBySeedSlot: new Map(
      seedSlotNames.map(({ name, ...slot }) => [toSeedSlotKey(slot), name]),
    ),
    seedByName: new Map([
      ...seedSlotNames.map(({ name, seed }) => [name, seed] as const),
      ...wildCard.entrants.map(name => [name, wildCard.seed] as const),
    ]),
  }
}

// A battle's side once its combatant is known, or the earlier battle whose
// winner fills it
export type Side =
  | { kind: `combatant`; name: string; seed: Seed }
  | { kind: `undecided`; battle: BattleRef }

// The battle's sides, filled from the seed slots, the wild card's entrants,
// and the earlier battles' winners. Each winner must be a combatant in the
// bracket
export const fillSides = (
  bracket: SeededBracket,
  battle: BattleRef,
  winners: Winners,
): Side[] => {
  const toCombatant = (name: string): Side => ({
    kind: `combatant`,
    name,
    seed: bracket.seedByName.get(name)!,
  })
  if (battle.round === `WILD_CARD`) {
    return bracket.wildCardEntrants.map(toCombatant)
  }
  return readBattleSides(
    { ...battle, round: battle.round },
    bracket.wildCardSlot,
  ).map(side => {
    if (side.kind === `seedSlot`) {
      // Only the wild card's seed slot has no combatant, and its side is the
      // wild card's winner
      return toCombatant(
        bracket.nameBySeedSlot.get(toSeedSlotKey(side.seedSlot))!,
      )
    }
    const winner = winners[toBattleKey(side.battle)]
    return winner === undefined
      ? { kind: `undecided`, battle: side.battle }
      : toCombatant(winner)
  })
}

export const hasCombatant = (sides: Side[], name: string): boolean =>
  sides.some(side => side.kind === `combatant` && side.name === name)
