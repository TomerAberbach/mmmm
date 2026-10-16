import type { ReactNode } from 'react'
import type { BattleView, BracketView, Side } from '~/bracket-view.ts'
import { measureWidestName } from '~/name-width.ts'

const SIZE_CLASSES = {
  diagram: {
    box: `w-max`,
    row: `px-2`,
    height: `h-8`,
    // An ancestor sets `--name-width` to `readNameWidth`'s width
    name: `w-(--name-width) shrink-0`,
  },
  regular: { box: ``, row: `px-3`, height: `h-10`, name: `` },
}

const WILD_CARD_WINNER = `Wild card winner`

// The width in em that fits every name a diagram box in the view can show
export const readNameWidth = ({ battles }: BracketView): number =>
  measureWidestName([
    WILD_CARD_WINNER,
    ...[...battles.WILD_CARD, ...battles.ROUND_1].flatMap(({ sides }) =>
      sides.filter(side => side.kind === `combatant`).map(({ name }) => name),
    ),
  ])

// One battle's sides, with the winner shaded and the loser muted. Screen
// readers skip it, so pair it with `describeBattle`. A regular box fills its
// container and truncates long names
export const BattleBox = ({
  battle,
  size,
  mark,
}: {
  battle: BattleView
  size: keyof typeof SIZE_CLASSES
  mark?: SideMark
}) => {
  const classes = SIZE_CLASSES[size]
  return (
    <div
      dir='ltr'
      aria-hidden
      className={`border-2 border-ink bg-white text-base ${classes.box}`}
    >
      {battle.sides.map((side, index) => (
        <div
          // Sides never reorder
          key={index}
          className={`relative box-content flex items-center gap-2 not-first:border-t-2 not-first:border-muted-light ${classes.row} ${classes.height} ${readResultClasses(side, battle.winner)}`}
        >
          {index === mark?.side ? (
            <>
              <div
                className={`absolute inset-y-0 w-1 bg-accent ${mark.edge === `left` ? `left-0` : `right-0`}`}
              />
              {mark.content}
            </>
          ) : null}
          <span className='w-5 shrink-0 text-end text-muted tabular-nums'>
            {side.kind === `combatant` ? side.seed : null}
          </span>
          <SideName side={side} className={classes.name} />
        </div>
      ))}
    </div>
  )
}

// A side marked with an accent bar on one edge. The side's row holds
// `content`, such as a line arriving at that edge, positioned against the row
export type SideMark = {
  side: 0 | 1
  edge: `left` | `right`
  content: ReactNode
}

// An empty row as wide as a diagram box, for lining labels up with a column of
// boxes
export const BoxSizer = () => {
  const classes = SIZE_CLASSES.diagram
  return (
    <div
      aria-hidden
      className={`flex h-0 gap-2 overflow-hidden border-x-2 text-base ${classes.box} ${classes.row}`}
    >
      <span className='w-5 shrink-0' />
      <span className={classes.name} />
    </div>
  )
}

const readResultClasses = (side: Side, winner: string | undefined) => {
  if (winner === undefined || side.kind === `undecided`) {
    return ``
  }
  return side.name === winner
    ? `bg-accent-soft/40 font-extrabold`
    : `text-muted`
}

// An undecided side stays empty, except the one the wild card's winner fills
const SideName = ({ side, className }: { side: Side; className: string }) => {
  const name =
    side.kind === `combatant`
      ? side.name
      : side.battle.round === `WILD_CARD`
        ? WILD_CARD_WINNER
        : ``
  return (
    <span
      title={side.kind === `combatant` ? name : undefined}
      className={`truncate font-condensed font-bold tracking-wide uppercase ${side.kind === `combatant` ? `` : `text-muted`} ${className}`}
    >
      {name}
    </span>
  )
}
