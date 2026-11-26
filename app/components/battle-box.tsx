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
  ToggleButton,
} from 'react-aria-components'
import { INNER_FOCUS_CLASSES } from './focus-classes.ts'
import { usePicking } from './picking.ts'
import type { Picking } from './picking.ts'
import { describeBattle, readBattleName } from '~/bracket-view.ts'
import type { BattleView, BracketView } from '~/bracket-view.ts'
import { toBattleKey } from '~/bracket.ts'
import type { BattleRef } from '~/bracket.ts'
import { measureWidestName } from '~/name-width.ts'
import type { PickMark } from '~/scoring.ts'
import { findCombatant } from '~/seeded-bracket.ts'
import type { Combatant, Side } from '~/seeded-bracket.ts'

const SIZE_CLASSES = {
  diagram: {
    box: `w-max`,
    row: `px-2`,
    height: `h-8`,
    // An ancestor sets `--name-width` to `readNameWidth`'s width
    name: `w-(--name-width) shrink-0`,
    mark: `w-8 shrink-0`,
  },
  regular: {
    box: ``,
    row: `px-3`,
    height: `h-10`,
    name: ``,
    mark: `shrink-0`,
  },
}

const WILD_CARD_WINNER = `Wild card winner`

/** The width in em that fits every name a diagram box in the view can show */
export const readNameWidth = ({ battles }: BracketView): number =>
  measureWidestName([
    WILD_CARD_WINNER,
    ...[...battles.WILD_CARD, ...battles.ROUND_1].flatMap(({ sides }) =>
      sides.flatMap(side =>
        side.kind === `combatant` ? side.combatant.name : [],
      ),
    ),
  ])

/**
 * One battle's sides, with the winner shaded and the loser muted, or with the
 * pick marked, and the actual winner of a battle picked wrong. Screen readers
 * skip the boxes, so a regular box adds `describeBattle`'s text for them. A
 * diagram box adds none, since a list of the battles beside the diagram
 * describes them. Inside a `PickingContext`, each side is a radio button
 * instead, and a side not yet decided opens a menu of the combatants who could
 * fill it. A regular box fills its container and truncates long names
 */
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
          <ReadOnlySide
            // Sides never reorder
            key={index}
            side={side}
            battle={battle}
            classes={classes}
            wildCardLineBar={
              <WildCardLineBar wildCardLine={wildCardLine} side={index} />
            }
          />
        ))}
        {size === `diagram` && battle.round !== `ROUND_1` ? (
          <WonBy
            battle={battle}
            className='absolute inset-x-0 top-full mt-0.5 truncate'
          />
        ) : null}
      </div>
      {size === `regular` ? <WonBy battle={battle} className='mt-1' /> : null}
    </>
  )
}

/**
 * The end of the wild card's line on the side its winner fills: an accent bar
 * on the edge the line arrives at, and `content`, the line's last turn,
 * positioned against the side's row
 */
export type WildCardLine = {
  side: 0 | 1
  edge: `left` | `right`
  content: ReactNode
}

/**
 * An empty row as wide as a diagram box, for lining labels up with a column of
 * boxes
 */
export const BoxSizer = ({ hasMarks }: { hasMarks: boolean }) => {
  const classes = SIZE_CLASSES.diagram
  return (
    <div
      aria-hidden
      className={`flex h-0 gap-2 overflow-hidden border-x-2 text-base ${classes.box} ${classes.row}`}
    >
      <span className='w-5 shrink-0' />
      <span className={classes.name} />
      {hasMarks ? <span className={classes.mark} /> : null}
    </div>
  )
}

const readResultClasses = (side: Side, winner: Combatant | undefined) => {
  if (winner === undefined || side.kind === `undecided`) {
    return ``
  }
  return side.combatant.id === winner.id
    ? `bg-accent-soft/40 font-extrabold`
    : `text-muted`
}

/** How a side stands on a marked bracket. Null when neither picked nor won */
type SideState = PickMark | `ACTUAL_WINNER`

const readSideState = (
  side: Side,
  { winner, marking }: BattleView,
): SideState | null => {
  if (side.kind === `undecided` || !marking) {
    return null
  }
  const { id } = side.combatant
  if (id === winner?.id) {
    return marking.mark
  }
  return id === marking.actualWinner?.id ? `ACTUAL_WINNER` : null
}

const STATE_CLASSES: Record<SideState, string> = {
  RIGHT: `bg-accent-soft/40 font-extrabold`,
  WRONG: `font-extrabold text-danger`,
  UNDECIDED: `bg-ink/5 font-extrabold`,
  ACTUAL_WINNER: `font-extrabold`,
}

const STATE_MARKS: Record<SideState, ReactNode> = {
  RIGHT: <span className='text-accent-strong'>✓</span>,
  WRONG: `✗`,
  UNDECIDED: null,
  ACTUAL_WINNER: <span className='text-sm font-semibold text-muted'>won</span>,
}

const ReadOnlySide = ({
  side,
  battle,
  classes,
  wildCardLineBar,
}: {
  side: Side
  battle: BattleView
  classes: SizeClasses
  wildCardLineBar: ReactNode
}) => {
  const state = readSideState(side, battle)
  return (
    <div
      className={`${readRowClasses(classes)} ${state ? STATE_CLASSES[state] : readResultClasses(side, battle.winner)}`}
    >
      {wildCardLineBar}
      <SeedNumber side={side} />
      <SideName
        side={side}
        className={`${classes.name} ${state === `WRONG` ? `line-through decoration-2` : ``}`}
      />
      {battle.marking ? (
        <span className={`ms-auto text-end ${classes.mark}`}>
          {state && STATE_MARKS[state]}
        </span>
      ) : null}
    </div>
  )
}

/** The actual winner of a battle picked wrong, when it isn't one of the sides */
const WonBy = ({
  battle: { sides, marking },
  className,
}: {
  battle: BattleView
  className: string
}) => {
  if (marking?.mark !== `WRONG` || !marking.actualWinner) {
    return null
  }
  const { id, name } = marking.actualWinner
  return findCombatant(sides, id) ? null : (
    <p aria-hidden className={`text-sm text-muted ${className}`}>
      Won by <span className='font-semibold text-ink'>{name}</span>
    </p>
  )
}

const readSideName = (side: Side): string =>
  side.kind === `combatant`
    ? side.combatant.name
    : side.battle.round === `WILD_CARD`
      ? WILD_CARD_WINNER
      : ``

/**
 * An undecided side stays empty, except the one the wild card's winner fills
 */
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
  `relative border-2 border-ink bg-white text-base ${classes.box}`

const readRowClasses = (classes: SizeClasses) =>
  `relative box-content flex items-center gap-2 not-first:border-t-2 not-first:border-muted-light ${classes.row} ${classes.height}`

const FOCUS_CLASSES = `cursor-pointer ${INNER_FOCUS_CLASSES}`

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
    {side.kind === `combatant` ? side.combatant.seed : null}
  </span>
)

type PickableBoxProps = {
  battle: BattleView
  classes: SizeClasses
  wildCardLine: WildCardLine | undefined
  picking: Picking
}

const PickableBattleBox = (props: PickableBoxProps) =>
  props.picking.kind === `results` ? (
    <ResultBox {...props} />
  ) : (
    <PickBox {...props} />
  )

const readPickableBoxProps = ({
  battle,
  classes,
  picking,
}: PickableBoxProps) => ({
  'aria-label': readBattleName(battle),
  dir: `ltr`,
  'data-battle': toBattleKey(battle),
  className: `${readBoxClasses(classes)} ${picking.isCleared(battle) ? `outline-4 outline-offset-2 outline-sweet-16` : ``}`,
})

const PickBox = (props: PickableBoxProps) => {
  const { battle, classes, wildCardLine, picking } = props
  return (
    <RadioGroup
      {...readPickableBoxProps(props)}
      value={battle.winner?.id ?? null}
      onChange={winner => picking.pick(battle, winner)}
    >
      {battle.sides.map((side, index) =>
        side.kind === `combatant` ? (
          <RadioField
            // Sides never reorder
            key={index}
            value={side.combatant.id}
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
          <UndecidedSide key={index} {...props} side={side} index={index} />
        ),
      )}
    </RadioGroup>
  )
}

/** Each side is a toggle button, since pressing a recorded winner clears it */
const ResultBox = (props: PickableBoxProps) => {
  const { battle, classes, wildCardLine, picking } = props
  const boxProps = readPickableBoxProps(props)
  return (
    // A fieldset grows to fit its longest name unless its minimum width is zero
    <fieldset {...boxProps} className={`min-w-0 ${boxProps.className}`}>
      {battle.sides.map((side, index) =>
        side.kind === `combatant` ? (
          <div
            // Sides never reorder
            key={index}
            className={`${readRowClasses(classes)} hover:bg-ink/5 ${readResultClasses(side, battle.winner)}`}
          >
            <WildCardLineBar wildCardLine={wildCardLine} side={index} />
            <ToggleButton
              isSelected={side.combatant.id === battle.winner?.id}
              onChange={() => picking.pick(battle, side.combatant.id)}
              className={`flex min-w-0 flex-1 items-center gap-2 self-stretch text-start ${FOCUS_CLASSES}`}
            >
              <SeedNumber side={side} />
              <SideName side={side} className={classes.name} />
              {side.combatant.id === battle.winner?.id ? (
                <span className='sr-only'>, won. Press to clear</span>
              ) : null}
            </ToggleButton>
          </div>
        ) : (
          <UndecidedSide key={index} {...props} side={side} index={index} />
        ),
      )}
    </fieldset>
  )
}

const UndecidedSide = ({
  side,
  index,
  classes,
  wildCardLine,
  picking,
}: PickableBoxProps & {
  side: Extract<Side, { kind: `undecided` }>
  index: number
}) => (
  <div className={readRowClasses(classes)}>
    <WildCardLineBar wildCardLine={wildCardLine} side={index} />
    <ContenderMenu side={side} className={classes.name} picking={picking} />
  </div>
)

/**
 * A side not yet decided. Picking one of its contenders picks them to win the
 * battle that fills the side, and their earlier wins
 */
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

/** Rendered only while the menu is open, so closed menus list nothing */
const ContenderList = ({
  battle,
  picking,
}: {
  battle: BattleRef
  picking: Picking
}) => (
  <>
    <p className='px-3 py-1.5 text-sm text-muted'>
      {picking.kind === `results`
        ? `Choose who gets here. Their earlier wins are recorded too`
        : `Pick who gets here. Their earlier wins fill in too`}
    </p>
    <Menu
      aria-label={`Who wins ${readBattleName(battle)}`}
      onAction={winner => picking.pick(battle, String(winner))}
      className='max-h-80 overflow-y-auto outline-none'
    >
      {picking.listContenders(battle).map(({ id, name }) => (
        <MenuItem
          key={id}
          id={id}
          className='cursor-pointer px-3 py-2 font-condensed font-bold tracking-wide uppercase outline-none not-last:border-b not-last:border-muted-light data-focused:bg-ink/5'
        >
          {name}
        </MenuItem>
      ))}
    </Menu>
  </>
)
