import { listSeedSlotNames, readNameBySeedSlot } from './bracket-input.ts'
import type { BracketInput } from './bracket-input.ts'
import {
  DIVISION_POSITIONS,
  listBattles,
  readBattleSides,
  ROUND_NAMES,
  ROUNDS,
  toBattleKey,
  toSeedSlotKey,
} from './bracket.ts'
import type {
  BattleRef,
  DivisionPosition,
  DivisionRound,
  Round,
  Seed,
  SeedSlotRef,
} from './bracket.ts'

// A battle's side once its combatant is known, or the earlier battle whose
// winner fills it
export type Side =
  | { kind: `combatant`; name: string; seed: Seed }
  | { kind: `undecided`; battle: BattleRef }

export type BattleView = BattleRef & { sides: Side[]; winner?: string }

export type BracketView = {
  year: number
  divisionNames: Record<DivisionPosition, string>
  wildCardSlot: SeedSlotRef
  battles: Record<Round, BattleView[]>
}

// Each decided battle's key, from `toBattleKey`, mapped to its winner's name
export type Winners = Readonly<Record<string, string>>

// Every battle of the bracket, with each side filled from the seed slots and
// the winners so far
export const buildBracketView = (
  year: number,
  input: BracketInput,
  winners: Winners,
): BracketView => {
  const wildCardSlot: SeedSlotRef = {
    position: input.wildCard.position,
    seed: input.wildCard.seed,
  }
  const nameBySeedSlot = readNameBySeedSlot(input)
  const seedByName = indexSeeds(input)

  // Every name is the input's, or a winner checked against its battle's sides
  // before any later battle reads it
  const toCombatant = (name: string): Side => ({
    kind: `combatant`,
    name,
    seed: seedByName.get(name)!,
  })
  const toWinnerSide = (battle: BattleRef): Side => {
    const winner = winners[toBattleKey(battle)]
    return winner === undefined
      ? { kind: `undecided`, battle }
      : toCombatant(winner)
  }
  const readSides = (battle: BattleRef): Side[] =>
    battle.round === `WILD_CARD`
      ? input.wildCard.entrants.map(toCombatant)
      : readBattleSides({ ...battle, round: battle.round }, wildCardSlot).map(
          side =>
            side.kind === `seedSlot`
              ? // Only the wild card's seed slot has no name, and its side is
                // the wild card's winner
                toCombatant(nameBySeedSlot.get(toSeedSlotKey(side.seedSlot))!)
              : toWinnerSide(side.battle),
        )

  const battles = Object.groupBy(
    listBattles().map((battle): BattleView => {
      const winner = winners[toBattleKey(battle)]
      const sides = readSides(battle)
      if (winner !== undefined) {
        assertWinnerHasSide(battle, sides, winner)
      }
      return {
        ...battle,
        sides,
        ...(winner === undefined ? {} : { winner }),
      }
    }),
    ({ round }) => round,
  ) as Record<Round, BattleView[]>

  return {
    year,
    divisionNames: Object.fromEntries(
      DIVISION_POSITIONS.map(position => [
        position,
        input.divisions[position].name,
      ]),
    ) as Record<DivisionPosition, string>,
    wildCardSlot,
    battles,
  }
}

// Each combatant's seed. Every wild card entrant has the wild card's seed
const indexSeeds = (input: BracketInput): ReadonlyMap<string, Seed> =>
  new Map([
    ...listSeedSlotNames(input).flatMap(({ name, seed }) =>
      name === undefined ? [] : [[name, seed] as const],
    ),
    ...input.wildCard.entrants.map(
      name => [name, input.wildCard.seed] as const,
    ),
  ])

const assertWinnerHasSide = (
  battle: BattleRef,
  sides: Side[],
  winner: string,
): void => {
  if (!sides.some(side => side.kind === `combatant` && side.name === winner)) {
    throw new Error(`${winner} isn't in ${readBattleName(battle)}`)
  }
}

// The round's battles within the division, top to bottom
export const readDivisionBattles = (
  { battles }: BracketView,
  round: DivisionRound,
  position: DivisionPosition,
): BattleView[] => {
  const perDivision = battles[round].length / DIVISION_POSITIONS.length
  const start = DIVISION_POSITIONS.indexOf(position) * perDivision
  return battles[round].slice(start, start + perDivision)
}

// For screen readers, such as "Round 2, battle 3: Okapi vs. Puma, Okapi won"
export const describeBattle = ({
  round,
  index,
  sides,
  winner,
}: BattleView): string => {
  const sideNames = sides.map(describeSide).join(` vs. `)
  const result = winner === undefined ? `` : `, ${winner} won`
  return `${readBattleName({ round, index })}: ${sideNames}${result}`
}

const describeSide = (side: Side): string =>
  side.kind === `combatant`
    ? side.name
    : `winner of ${
        side.battle.round === `WILD_CARD`
          ? `the wild card`
          : readBattleName(side.battle)
      }`

// Battles are numbered from 1 within their round
export const readBattleName = ({ round, index }: BattleRef): string =>
  round === `WILD_CARD`
    ? ROUND_NAMES.WILD_CARD
    : `${ROUND_NAMES[round]}, battle ${index + 1}`

// The round to show first: the earliest from Round 1 on with a battle left to
// decide, or the Championship once every battle is decided. Round 1 already
// shows where the wild card's winner goes
export const readStartingRound = ({ battles }: BracketView): Round =>
  ROUNDS.slice(ROUNDS.indexOf(`ROUND_1`)).find(round =>
    battles[round].some(battle => battle.winner === undefined),
  ) ?? `CHAMPIONSHIP`
