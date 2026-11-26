import type { BracketInput, CombatantPlace } from '../app/bracket-input.ts'
import {
  DIVISION_POSITIONS,
  ROUNDS,
  SEEDS,
  toBattleKey,
} from '../app/bracket.ts'
import type { SeedSlotRef } from '../app/bracket.ts'

/**
 * Mmmm-old stored a bracket, its results, and each submission as a binary heap
 * of names. Node 0 is the champion, nodes 31 to 62 won Round 1, and nodes 63 to
 * 126 are the combatants, in diagram order. One of those is the wild card, as
 * its winner and two entrants. A name ends with its seed, such as
 * "Nile Crocodile (1)". Null where nothing is decided
 */
export type OldWinners = (string | null | (string | null)[])[]

const NODE_COUNT = 127
const FIRST_COMBATANT_NODE = 63

/** Each division's seeds, top to bottom */
const SEED_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15]

/** Null for a string that isn't a heap with one wild card */
export const parseOldWinners = (json: string): OldWinners | null => {
  let nodes: unknown
  try {
    nodes = JSON.parse(json)
  } catch {
    return null
  }
  if (!Array.isArray(nodes) || nodes.length !== NODE_COUNT) {
    return null
  }
  const isName = (node: unknown) => node === null || typeof node === `string`
  const isWildCard = (node: unknown) =>
    Array.isArray(node) && node.length === 3 && node.every(isName)
  const wildCards = nodes.filter(isWildCard)
  return wildCards.length === 1 &&
    nodes.every(
      (node, index) =>
        isName(node) || (index >= FIRST_COMBATANT_NODE && isWildCard(node)),
    )
    ? (nodes as OldWinners)
    : null
}

/** Null unless every combatant has a name */
export const toBracketInput = (
  divisionNames: [string, string, string, string],
  winners: OldWinners,
): BracketInput | null => {
  const divisions = DIVISION_POSITIONS.map((position, index) => ({
    position,
    name: divisionNames[index]!,
    bySeed: new Map<number, string>(),
  }))
  let wildCard: BracketInput[`wildCard`] | null = null
  for (let node = FIRST_COMBATANT_NODE; node < NODE_COUNT; node++) {
    const { position, seed } = readSeedSlot(node)
    const value = winners[node]!
    if (Array.isArray(value)) {
      const entrants = value.slice(1).map(stripSeed)
      if (entrants.includes(null)) {
        return null
      }
      wildCard = { position, seed, entrants: entrants as string[] }
      continue
    }
    const name = stripSeed(value)
    if (name === null) {
      return null
    }
    divisions
      .find(division => division.position === position)!
      .bySeed.set(seed, name)
  }
  return (
    wildCard && {
      divisions: Object.fromEntries(
        divisions.map(({ position, name, bySeed }) => [
          position,
          {
            name: name.trim(),
            combatants: SEEDS.flatMap(seed => bySeed.get(seed) ?? []),
          },
        ]),
      ) as BracketInput[`divisions`],
      wildCard,
    }
  )
}

const readSeedSlot = (node: number): SeedSlotRef => {
  const index = node - FIRST_COMBATANT_NODE
  return {
    position: DIVISION_POSITIONS[Math.trunc(index / SEED_ORDER.length)]!,
    seed: SEED_ORDER[index % SEED_ORDER.length] as SeedSlotRef[`seed`],
  }
}

const stripSeed = (name: string | null): string | null => {
  const stripped = name?.replace(/\s*\((?:W\/)?\d+\)\s*$/u, ``).trim()
  return stripped === undefined || stripped === `` ? null : stripped
}

/**
 * Each decided battle's winner, keyed by `toBattleKey`. Follows positions rather
 * than names, so two combatants can share one. `unknown` counts the battles won
 * by a name on neither side, which are left undecided
 */
export const readOldWinners = (
  winners: OldWinners,
): { winners: Record<string, CombatantPlace>; unknown: number } => {
  const decided: Record<string, CombatantPlace> = {}
  let unknown = 0

  const readNode = (
    node: number,
  ): { name: string; place: CombatantPlace } | null => {
    const value = winners[node] ?? null
    if (Array.isArray(value)) {
      return readWildCard(value)
    }
    if (node >= FIRST_COMBATANT_NODE) {
      return value === null
        ? null
        : {
            name: value,
            place: { kind: `seedSlot`, seedSlot: readSeedSlot(node) },
          }
    }
    const sides = [readNode(2 * node + 1), readNode(2 * node + 2)]
    if (value === null) {
      return null
    }
    const winner = sides.find(side => side?.name === value)
    if (!winner) {
      unknown++
      return null
    }
    decided[readBattleKey(node)] = winner.place
    return winner
  }

  const readWildCard = ([winner, ...entrants]: (string | null)[]) => {
    if (winner == null) {
      return null
    }
    const index = entrants.indexOf(winner)
    if (index === -1) {
      unknown++
      return null
    }
    const place: CombatantPlace = { kind: `entrant`, index }
    decided[toBattleKey({ round: `WILD_CARD`, index: 0 })] = place
    return { name: winner, place }
  }

  readNode(0)
  return { winners: decided, unknown }
}

const readBattleKey = (node: number): string => {
  const level = Math.trunc(Math.log2(node + 1))
  return toBattleKey({
    round: ROUNDS.at(-1 - level)!,
    index: node + 1 - 2 ** level,
  })
}
