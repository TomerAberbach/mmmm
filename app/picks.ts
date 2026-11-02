import { readNameBySeedSlot } from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'
import type { Winners } from './bracket-view.ts'
import {
  listBattles,
  readBattleSides,
  toBattleKey,
  toSeedSlotKey,
} from './bracket.ts'
import type { BattleRef, Round, SeedSlotRef } from './bracket.ts'

export type Picks = Winners

export const TOTAL_BATTLES = listBattles().length

// What the pick rules need from a bracket
export type PickBracket = {
  wildCardSlot: SeedSlotRef
  wildCardEntrants: readonly string[]
  nameBySeedSlot: ReadonlyMap<string, string>
}

export const toPickBracket = (input: BracketInput): PickBracket => ({
  wildCardSlot: {
    position: input.wildCard.position,
    seed: input.wildCard.seed,
  },
  wildCardEntrants: input.wildCard.entrants,
  nameBySeedSlot: readNameBySeedSlot(input),
})

// Every combatant who could win the battle, whatever the picks
export const listContenders = (
  bracket: PickBracket,
  battle: BattleRef,
): string[] =>
  battle.round === `WILD_CARD`
    ? [...bracket.wildCardEntrants]
    : readPickSides(bracket, { ...battle, round: battle.round }).flatMap(side =>
        listSideContenders(bracket, side),
      )

const listSideContenders = (bracket: PickBracket, side: PickSide): string[] =>
  `name` in side ? [side.name] : listContenders(bracket, side.battle)

// Picks `winner` in the battle, and in every earlier battle on its way there.
// Clears each later pick that no longer has its winner on one of its battle's
// sides. Throws when the winner can't reach the battle
export const pickWinner = (
  bracket: PickBracket,
  picks: Picks,
  battle: BattleRef,
  winner: string,
): { picks: Picks; cleared: BattleRef[] } => {
  if (!listContenders(bracket, battle).includes(winner)) {
    throw new Error(`${winner} can't reach ${toBattleKey(battle)}`)
  }
  const next = new Map(Object.entries(picks))
  for (const won of listPathTo(bracket, battle, winner)) {
    next.set(toBattleKey(won), winner)
  }
  const cleared = clearUnreachablePicks(bracket, next)
  return { picks: Object.fromEntries(next), cleared }
}

// Whether every pick is of a battle in the bracket, with a winner on one of its
// sides
export const arePicksConsistent = (
  bracket: PickBracket,
  picks: Picks,
): boolean => {
  const battleKeys = new Set(listBattles().map(toBattleKey))
  return (
    Object.keys(picks).every(key => battleKeys.has(key)) &&
    clearUnreachablePicks(bracket, new Map(Object.entries(picks))).length === 0
  )
}

// The battle, then each earlier battle the winner wins on its way there
const listPathTo = (
  bracket: PickBracket,
  battle: BattleRef,
  winner: string,
): BattleRef[] => {
  if (battle.round === `WILD_CARD`) {
    return [battle]
  }
  const side = readPickSides(bracket, {
    ...battle,
    round: battle.round,
  }).find(candidate => listSideContenders(bracket, candidate).includes(winner))!
  return `name` in side
    ? [battle]
    : [battle, ...listPathTo(bracket, side.battle, winner)]
}

// Clears, in play order, each pick whose winner isn't on one of its battle's
// sides, so a clear cascades to the picks after it. Returns the cleared battles
const clearUnreachablePicks = (
  bracket: PickBracket,
  picks: Map<string, string>,
): BattleRef[] => {
  const cleared: BattleRef[] = []
  for (const battle of listBattles()) {
    const key = toBattleKey(battle)
    const winner = picks.get(key)
    if (
      winner !== undefined &&
      !readSideNames(bracket, picks, battle).includes(winner)
    ) {
      picks.delete(key)
      cleared.push(battle)
    }
  }
  return cleared
}

// The names on the battle's sides so far
const readSideNames = (
  bracket: PickBracket,
  picks: ReadonlyMap<string, string>,
  battle: BattleRef,
): string[] =>
  battle.round === `WILD_CARD`
    ? [...bracket.wildCardEntrants]
    : readPickSides(bracket, { ...battle, round: battle.round })
        .map(side =>
          `name` in side ? side.name : picks.get(toBattleKey(side.battle)),
        )
        .filter(name => name !== undefined)

// A battle's side, with a seed slot resolved to its combatant's name
type PickSide = { name: string } | { battle: BattleRef }

const readPickSides = (
  bracket: PickBracket,
  battle: BattleRef & { round: Exclude<Round, `WILD_CARD`> },
): PickSide[] =>
  readBattleSides(battle, bracket.wildCardSlot).map(side =>
    side.kind === `seedSlot`
      ? { name: bracket.nameBySeedSlot.get(toSeedSlotKey(side.seedSlot))! }
      : { battle: side.battle },
  )
