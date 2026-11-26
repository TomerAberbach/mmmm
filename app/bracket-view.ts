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
import type { Picks } from './picks.ts'
import type { Results } from './results.ts'
import { markPick } from './scoring.ts'
import type { PickMark } from './scoring.ts'
import { fillSides, findCombatant } from './seeded-bracket.ts'
import type { Combatant, SeededBracket, Side } from './seeded-bracket.ts'

export type BattleView = BattleRef & {
  sides: Side[]
  winner?: Combatant
  marking?: Marking
}

/**
 * How the pick of a battle's winner stands, or null without a pick, and who won
 * the battle once it's decided
 */
type Marking = { mark: PickMark | null; actualWinner?: Combatant }

type MarkedBattleView = BattleView & { marking: Marking }

export type BracketView = {
  year: number
  divisionNames: Record<DivisionPosition, string>
  wildCardSlot: SeedSlotRef
  battles: Record<Round, BattleView[]>
}

/**
 * Every battle of the bracket, with each side filled from the seed slots and
 * the winners so far. Throws when a winner isn't on one of its battle's sides
 */
export const buildBracketView = (
  year: number,
  bracket: SeededBracket,
  winners: Winners,
): BracketView => {
  // In play order, so each winner is checked before a later battle's side
  // reads it
  const battles = Object.groupBy(
    listBattles().map((battle): BattleView => {
      const winnerId = winners[toBattleKey(battle)]
      const sides = fillSides(bracket, battle, winners)
      if (winnerId === undefined) {
        return { ...battle, sides }
      }
      const winner = findCombatant(sides, winnerId)
      if (!winner) {
        throw new Error(`${winnerId} isn't in ${readBattleName(battle)}`)
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

/** A bracket whose winners are picks, each marked against the results */
export type MarkedBracketView = Omit<BracketView, `battles`> & {
  battles: Record<Round, MarkedBattleView[]>
}

export const buildMarkedBracketView = (
  year: number,
  bracket: SeededBracket,
  picks: Picks,
  results: Results,
): MarkedBracketView => {
  const view = buildBracketView(year, bracket, picks)
  const markBattle = (battle: BattleView): MarkedBattleView => {
    const { winner } = battle
    const result = results[toBattleKey(battle)]
    return {
      ...battle,
      marking: {
        mark: winner ? markPick(bracket, results, battle, winner.id) : null,
        ...(result !== undefined && {
          actualWinner: bracket.combatantById.get(result)!,
        }),
      },
    }
  }
  return {
    ...view,
    battles: Object.fromEntries(
      ROUNDS.map(round => [round, view.battles[round].map(markBattle)]),
    ) as Record<Round, MarkedBattleView[]>,
  }
}

/** The round's battles within the division, top to bottom */
export const readDivisionBattles = (
  { battles }: BracketView,
  round: DivisionRound,
  position: DivisionPosition,
): BattleView[] => {
  const perDivision = battles[round].length / DIVISION_POSITIONS.length
  const start = DIVISION_POSITIONS.indexOf(position) * perDivision
  return battles[round].slice(start, start + perDivision)
}

/**
 * For screen readers, such as "Round 2, battle 3: Okapi vs. Puma, Okapi won".
 * On a marked bracket, it ends like ". Picked Puma, wrong, Okapi won" instead
 */
export const describeBattle = ({
  round,
  index,
  sides,
  winner,
  marking,
}: BattleView): string => {
  const sideNames = sides.map(describeSide).join(` vs. `)
  const result =
    winner === undefined
      ? ``
      : marking
        ? `. Picked ${winner.name}, ${describeMarking(marking)}`
        : `, ${winner.name} won`
  return `${readBattleName({ round, index })}: ${sideNames}${result}`
}

const describeMarking = ({ mark, actualWinner }: Marking): string => {
  if (mark === `RIGHT`) {
    return `right`
  }
  const result = actualWinner ? `${actualWinner.name} won` : `not decided yet`
  return mark === `WRONG` ? `wrong, ${result}` : result
}

const describeSide = (side: Side): string =>
  side.kind === `combatant`
    ? side.combatant.name
    : `winner of ${
        side.battle.round === `WILD_CARD`
          ? `the wild card`
          : readBattleName(side.battle)
      }`

/** Battles are numbered from 1 within their round */
export const readBattleName = ({ round, index }: BattleRef): string =>
  round === `WILD_CARD`
    ? ROUND_NAMES.WILD_CARD
    : `${ROUND_NAMES[round]}, battle ${index + 1}`

/** Whether the bracket's winners are marked picks */
export const isMarked = (view: BracketView): view is MarkedBracketView =>
  view.battles.WILD_CARD.some(({ marking }) => marking !== undefined)

/** On a marked bracket, a battle is decided by its result instead of its pick */
export const isDecided = ({ winner, marking }: BattleView): boolean =>
  (marking ? marking.actualWinner : winner) !== undefined

/**
 * The round to show first: the earliest from Round 1 on with a battle left to
 * decide, or the Championship once every battle is decided. Round 1 already
 * shows where the wild card's winner goes
 */
export const readStartingRound = ({ battles }: BracketView): Round =>
  ROUNDS.slice(ROUNDS.indexOf(`ROUND_1`)).find(round =>
    battles[round].some(battle => !isDecided(battle)),
  ) ?? `CHAMPIONSHIP`
