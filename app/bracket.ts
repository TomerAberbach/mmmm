import { DivisionPosition, Round } from './generated/prisma/enums.ts'

// Diagram order: the two left divisions, then the two right ones, so
// consecutive pairs meet in the Final Roar
export const DIVISION_POSITIONS = Object.values(DivisionPosition)

export const ROUNDS = Object.values(Round)

export const BATTLE_COUNTS: Record<Round, number> = {
  WILD_CARD: 1,
  ROUND_1: 32,
  ROUND_2: 16,
  SWEET_16: 8,
  ELITE_TRAIT: 4,
  FINAL_ROAR: 2,
  CHAMPIONSHIP: 1,
}

export const MIN_WILD_CARD_ENTRANTS = 2
export const MAX_WILD_CARD_ENTRANTS = 4

// Round 1 pairs each division's seeds in NCAA order, top to bottom
const SEED_PAIRS = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
] as const

// Each of a division's seeds, 1 to 16
export type Seed = (typeof SEED_PAIRS)[number][number]

// Built from `SEED_PAIRS`, so every seed has its pair's index
const PAIR_INDEX_BY_SEED = Object.fromEntries(
  SEED_PAIRS.flatMap((pair, index) => pair.map(seed => [seed, index])),
) as Record<Seed, number>

export const SEEDS: readonly Seed[] = SEED_PAIRS.flat().toSorted(
  (first, second) => first - second,
)

export const SEEDS_PER_DIVISION = SEEDS.length

export type SeedSlotRef = { position: DivisionPosition; seed: Seed }

export type BattleRef = { round: Round; index: number }

// Every battle in play order: the wild card, then each round top to bottom
export const listBattles = (): BattleRef[] =>
  ROUNDS.flatMap(round =>
    Array.from({ length: BATTLE_COUNTS[round] }, (_, index) => ({
      round,
      index,
    })),
  )

// What fills one side of a battle after the wild card: a seed slot's
// combatant, or an earlier battle's winner
type BattleSide =
  | { kind: `seedSlot`; seedSlot: SeedSlotRef }
  | { kind: `winner`; battle: BattleRef }

const WILD_CARD_BATTLE: BattleRef = { round: `WILD_CARD`, index: 0 }

// The wild card's battle has 2 to 4 entrants instead of two sides. Its winner
// fills the wild card's seed slot in Round 1
export const readBattleSides = (
  battle: BattleRef & { round: Exclude<Round, `WILD_CARD`> },
  wildCardSlot: SeedSlotRef,
): [BattleSide, BattleSide] => {
  assertBattleExists(battle)
  if (battle.round === `ROUND_1`) {
    return readRound1Sides(battle.index, wildCardSlot)
  }
  const previousRound = ROUNDS[ROUNDS.indexOf(battle.round) - 1]!
  const winnerOf = (index: number): BattleSide => ({
    kind: `winner`,
    battle: { round: previousRound, index },
  })
  return [winnerOf(battle.index * 2), winnerOf(battle.index * 2 + 1)]
}

// The division's seed pair for the battle's place in Round 1
const readRound1Sides = (
  index: number,
  wildCardSlot: SeedSlotRef,
): [BattleSide, BattleSide] => {
  // In range, since the battle exists
  const position = DIVISION_POSITIONS[Math.floor(index / SEED_PAIRS.length)]!
  const [higherSeed, lowerSeed] = SEED_PAIRS[index % SEED_PAIRS.length]!
  return [
    readSeedSlotSide({ position, seed: higherSeed }, wildCardSlot),
    readSeedSlotSide({ position, seed: lowerSeed }, wildCardSlot),
  ]
}

const readSeedSlotSide = (
  seedSlot: SeedSlotRef,
  wildCardSlot: SeedSlotRef,
): BattleSide =>
  isSameSeedSlot(seedSlot, wildCardSlot)
    ? { kind: `winner`, battle: WILD_CARD_BATTLE }
    : { kind: `seedSlot`, seedSlot }

// The battle the winner moves on to, or undefined after the Championship
export const readNextBattle = (
  battle: BattleRef,
  wildCardSlot: SeedSlotRef,
): BattleRef | undefined => {
  assertBattleExists(battle)
  if (battle.round === `WILD_CARD`) {
    return { round: `ROUND_1`, index: readRound1Index(wildCardSlot) }
  }
  const round = ROUNDS[ROUNDS.indexOf(battle.round) + 1]
  return round && { round, index: Math.floor(battle.index / 2) }
}

// The Round 1 battle where a seed slot's combatant starts
const readRound1Index = ({ position, seed }: SeedSlotRef): number =>
  DIVISION_POSITIONS.indexOf(position) * SEED_PAIRS.length +
  PAIR_INDEX_BY_SEED[seed]

const assertBattleExists = ({ round, index }: BattleRef): void => {
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= BATTLE_COUNTS[round]
  ) {
    throw new RangeError(`No battle ${index} in ${round}`)
  }
}

const isSameSeedSlot = (first: SeedSlotRef, second: SeedSlotRef): boolean =>
  first.position === second.position && first.seed === second.seed

export { DivisionPosition, Round } from './generated/prisma/enums.ts'
