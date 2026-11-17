import {
  DIVISION_POSITIONS,
  listBattles,
  ROUND_NAMES,
  ROUNDS,
  toBattleKey,
} from './bracket.ts'
import type {
  BattleRef,
  DivisionPosition,
  DivisionRound,
  Round,
  SeedSlotRef,
  Winners,
} from './bracket.ts'
import { fillSides, hasCombatant } from './seeded-bracket.ts'
import type { SeededBracket, Side } from './seeded-bracket.ts'

export type BattleView = BattleRef & { sides: Side[]; winner?: string }

export type BracketView = {
  year: number
  divisionNames: Record<DivisionPosition, string>
  wildCardSlot: SeedSlotRef
  battles: Record<Round, BattleView[]>
}

// Every battle of the bracket, with each side filled from the seed slots and
// the winners so far. Throws when a winner isn't on one of its battle's sides
export const buildBracketView = (
  year: number,
  bracket: SeededBracket,
  winners: Winners,
): BracketView => {
  // In play order, so each winner is checked before a later battle's side
  // reads it
  const battles = Object.groupBy(
    listBattles().map((battle): BattleView => {
      const winner = winners[toBattleKey(battle)]
      const sides = fillSides(bracket, battle, winners)
      if (winner === undefined) {
        return { ...battle, sides }
      }
      if (!hasCombatant(sides, winner)) {
        throw new Error(`${winner} isn't in ${readBattleName(battle)}`)
      }
      return { ...battle, sides, winner }
    }),
    ({ round }) => round,
  ) as Record<Round, BattleView[]>

  return {
    year,
    divisionNames: bracket.divisionNames,
    wildCardSlot: bracket.wildCardSlot,
    battles,
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
