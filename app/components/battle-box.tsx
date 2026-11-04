import type { ReactNode } from 'react'
import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  RadioButton,
  RadioField,
  RadioGroup,
} from 'react-aria-components'
import { usePicking } from './picking.ts'
import type { Picking } from './picking.ts'
import { describeBattle, readBattleName } from '~/bracket-view.ts'
import type { BattleView, BracketView } from '~/bracket-view.ts'
import { toBattleKey } from '~/bracket.ts'
import type { BattleRef } from '~/bracket.ts'
import { measureWidestName } from '~/name-width.ts'
import type { Side } from '~/seeded-bracket.ts'

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
// readers skip the boxes, so a regular box adds `describeBattle`'s text for
// them. A diagram box adds none, since a list of the battles beside the diagram
// describes them. Inside a `PickingContext`, each side is a radio button
// instead, and a side not yet decided opens a menu of the combatants who could
// fill it. A regular box fills its container and truncates long names
export const BattleBox = ({
  battle,
  size,
  wildCardLine,
}: {
  battle: BattleView
  size: keyof typeof SIZE_CLASSES
  wildCardLine?: WildCardLine
}) => {
  const picking = usePicking()
  const classes = SIZE_CLASSES[size]
  if (picking) {
    return (
      <PickableBattleBox
        battle={battle}
        classes={classes}
        wildCardLine={wildCardLine}
        picking={picking}
      />
    )
  }
  return (
    <>
      {size === `regular` ? (
        <span className='sr-only'>{describeBattle(battle)}</span>
      ) : null}
      <div dir='ltr' aria-hidden className={readBoxClasses(classes)}>
        {battle.sides.map((side, index) => (
          <div
            // Sides never reorder
            key={index}
            className={`${readRowClasses(classes)} ${readResultClasses(side, battle.winner)}`}
          >
            <WildCardLineBar wildCardLine={wildCardLine} side={index} />
            <SeedNumber side={side} />
            <SideName side={side} className={classes.name} />
          </div>
        ))}
      </div>
    </>
  )
}

// The end of the wild card's line on the side its winner fills: an accent bar
// on the edge the line arrives at, and `content`, the line's last turn,
// positioned against the side's row
export type WildCardLine = {
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

const readSideName = (side: Side): string =>
  side.kind === `combatant`
    ? side.name
    : side.battle.round === `WILD_CARD`
      ? WILD_CARD_WINNER
      : ``

// An undecided side stays empty, except the one the wild card's winner fills
const SideName = ({ side, className }: { side: Side; className: string }) => {
  const name = readSideName(side)
  return (
    <span
      title={side.kind === `combatant` ? name : undefined}
      className={`truncate font-condensed font-bold tracking-wide uppercase ${side.kind === `combatant` ? `` : `text-muted`} ${className}`}
    >
      {name}
    </span>
  )
}

type SizeClasses = (typeof SIZE_CLASSES)[keyof typeof SIZE_CLASSES]

const readBoxClasses = (classes: SizeClasses) =>
  `border-2 border-ink bg-white text-base ${classes.box}`

const readRowClasses = (classes: SizeClasses) =>
  `relative box-content flex items-center gap-2 not-first:border-t-2 not-first:border-muted-light ${classes.row} ${classes.height}`

const FOCUS_CLASSES = `cursor-pointer outline-none data-focus-visible:outline-3 data-focus-visible:-outline-offset-3 data-focus-visible:outline-accent-strong`

const WildCardLineBar = ({
  wildCardLine,
  side,
}: {
  wildCardLine: WildCardLine | undefined
  side: number
}) =>
  side === wildCardLine?.side ? (
    <>
      <div
        className={`absolute inset-y-0 w-1 bg-accent ${wildCardLine.edge === `left` ? `left-0` : `right-0`}`}
      />
      {wildCardLine.content}
    </>
  ) : null

const SeedNumber = ({ side }: { side: Side }) => (
  <span className='w-5 shrink-0 text-end text-muted tabular-nums'>
    {side.kind === `combatant` ? side.seed : null}
  </span>
)

const PickableBattleBox = ({
  battle,
  classes,
  wildCardLine,
  picking,
}: {
  battle: BattleView
  classes: SizeClasses
  wildCardLine: WildCardLine | undefined
  picking: Picking
}) => (
  <RadioGroup
    aria-label={readBattleName(battle)}
    value={battle.winner ?? null}
    onChange={winner => picking.pick(battle, winner)}
    dir='ltr'
    data-battle={toBattleKey(battle)}
    className={`${readBoxClasses(classes)} ${picking.isCleared(battle) ? `outline-4 outline-offset-2 outline-sweet-16` : ``}`}
  >
    {battle.sides.map((side, index) =>
      side.kind === `combatant` ? (
        <RadioField
          // Sides never reorder
          key={index}
          value={side.name}
          className={`${readRowClasses(classes)} hover:bg-ink/5 ${readResultClasses(side, battle.winner)}`}
        >
          <WildCardLineBar wildCardLine={wildCardLine} side={index} />
          <RadioButton
            className={`flex min-w-0 flex-1 items-center gap-2 self-stretch ${FOCUS_CLASSES}`}
          >
            <SeedNumber side={side} />
            <SideName side={side} className={classes.name} />
          </RadioButton>
        </RadioField>
      ) : (
        <div key={index} className={readRowClasses(classes)}>
          <WildCardLineBar wildCardLine={wildCardLine} side={index} />
          <ContenderMenu
            side={side}
            className={classes.name}
            picking={picking}
          />
        </div>
      ),
    )}
  </RadioGroup>
)

// A side not yet decided. Picking one of its contenders picks them to win the
// battle that fills the side, and their earlier wins
const ContenderMenu = ({
  side,
  className,
  picking,
}: {
  side: Extract<Side, { kind: `undecided` }>
  className: string
  picking: Picking
}) => (
  <MenuTrigger>
    <Button
      // Starts with any text the side shows, so the name matches what's seen
      aria-label={[
        readSideName(side),
        `Pick who wins ${readBattleName(side.battle)}`,
      ]
        .filter(Boolean)
        .join(`. `)}
      className={`flex min-w-0 flex-1 items-center gap-2 self-stretch text-start hover:bg-ink/5 ${FOCUS_CLASSES}`}
    >
      <SeedNumber side={side} />
      <SideName side={side} className={className} />
      <span aria-hidden className='ms-auto text-muted'>
        ▾
      </span>
    </Button>
    <Popover
      placement='bottom start'
      className='w-72 border-2 border-ink bg-white shadow-offset'
    >
      <ContenderList battle={side.battle} picking={picking} />
    </Popover>
  </MenuTrigger>
)

// Rendered only while the menu is open, so closed menus list nothing
const ContenderList = ({
  battle,
  picking,
}: {
  battle: BattleRef
  picking: Picking
}) => (
  <>
    <p className='px-3 py-1.5 text-sm text-muted'>
      Pick who gets here. Their earlier wins fill in too
    </p>
    <Menu
      aria-label={`Who wins ${readBattleName(battle)}`}
      onAction={winner => picking.pick(battle, String(winner))}
      className='max-h-80 overflow-y-auto outline-none'
    >
      {picking.listContenders(battle).map(name => (
        <MenuItem
          key={name}
          id={name}
          className='cursor-pointer px-3 py-2 font-condensed font-bold tracking-wide uppercase outline-none not-last:border-b not-last:border-muted-light data-focused:bg-ink/5'
        >
          {name}
        </MenuItem>
      ))}
    </Menu>
  </>
)
