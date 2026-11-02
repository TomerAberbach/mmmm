import type { CSSProperties } from 'react'
import { BattleBox, BoxSizer, readNameWidth } from './battle-box.tsx'
import type { BattleView, BracketView } from '~/bracket-view.ts'
import {
  DIVISION_POSITIONS,
  DIVISION_ROUNDS,
  isDivisionRound,
  readBattleSides,
  readNextBattle,
  ROUND_NAMES,
} from '~/bracket.ts'
import type {
  BattleRef,
  DivisionPosition,
  DivisionRound,
  SeedSlotRef,
} from '~/bracket.ts'

// The whole bracket as ASU prints it: mirrored halves meeting at the
// Championship, division names on the outer edges, and round labels between
// each half's divisions
export const BracketDiagram = ({ view }: { view: BracketView }) => {
  const wildCard = readWildCardPlacement(view)
  const nameWidth = readNameWidth(view)
  const style = {
    '--name-width': `${nameWidth}em`,
    '--zoom': readPrintZoom(nameWidth, wildCard.battle.sides.length),
  } as CSSProperties
  return (
    <div className='overflow-x-auto print:overflow-visible'>
      <div
        style={style}
        className='mx-auto grid w-max auto-cols-auto py-14 print:zoom print:py-0'
      >
        {HALVES.map((half, finalRoarIndex) => (
          <Half
            key={finalRoarIndex}
            half={half}
            finalRoarIndex={finalRoarIndex}
            view={view}
            wildCard={wildCard}
          />
        ))}
        <Center view={view} />
      </div>
    </div>
  )
}

// Letter landscape inside the print margins, less main's padding and the page
// title, in px
export const PRINTED_PAGE = { width: 912, height: 628 }

// Zooming rounds each element's size up. Chromium printed 2025's diagram 0.6%
// larger than the estimate below
const ROUNDING_ROOM = 0.98

// The diagram's size, measured in Chromium: 11 boxes across, plus the
// connectors, gutters, and division names. Each wild card entrant adds a side
// to the wild card's box and to its invisible copy in the band
const DIAGRAM_SIZE = {
  boxesAcross: 11,
  boxPadding: 48,
  restOfWidth: 264,
  heightWithoutEntrants: 1610,
  entrantHeight: 68,
}

// Scales the printed diagram to fit one page
const readPrintZoom = (nameWidth: number, entrantCount: number): number => {
  const boxWidth = nameWidth * 16 + DIAGRAM_SIZE.boxPadding
  const width = DIAGRAM_SIZE.boxesAcross * boxWidth + DIAGRAM_SIZE.restOfWidth
  const height =
    DIAGRAM_SIZE.heightWithoutEntrants +
    DIAGRAM_SIZE.entrantHeight * entrantCount
  return (
    ROUNDING_ROOM *
    Math.min(PRINTED_PAGE.width / width, PRINTED_PAGE.height / height)
  )
}

// Room before a Round 1 box for the wild card's line
const ROUND_1_GUTTER = `ps-5`

// Room before a later round's box for its connector and `Stub`, each `w-2`
const CONNECTOR_GUTTER = `ps-4`

type HalfLayout = (typeof HALVES)[number]

// Grid columns run from the left half's divisions, through the Championship,
// to the right half's divisions. The right half mirrors the left through `dir`.
// Each half's Final Roar battle has the half's index
const HALVES = [
  {
    dir: `ltr`,
    positions: [`TOP_LEFT`, `BOTTOM_LEFT`],
    columns: {
      divisions: `col-start-1`,
      connector: `col-start-2`,
      finalRoar: `col-start-3`,
    },
  },
  {
    dir: `rtl`,
    positions: [`TOP_RIGHT`, `BOTTOM_RIGHT`],
    columns: {
      divisions: `col-start-7`,
      connector: `col-start-6`,
      finalRoar: `col-start-5`,
    },
  },
] as const satisfies {
  dir: `ltr` | `rtl`
  positions: [DivisionPosition, DivisionPosition]
  columns: Record<string, string>
}[]

// Where the wild card's box sits, and the Round 1 side its line runs into.
// The box sits beside its division, in the band between the half's divisions
type WildCardPlacement = {
  battle: BattleView
  slot: SeedSlotRef
  round1Index: number
  side: 0 | 1
  // The Round 1 box's edge the line arrives at, which the right half mirrors
  edge: `left` | `right`
  // Whether the box sits above its division, so the line runs down
  fromAbove: boolean
}

const readWildCardPlacement = ({
  battles,
  wildCardSlot,
}: BracketView): WildCardPlacement => {
  // The wild card always moves on to Round 1
  const round1Battle = readNextBattle(
    { round: `WILD_CARD`, index: 0 },
    wildCardSlot,
  )!
  const sides = readBattleSides(
    { round: `ROUND_1`, index: round1Battle.index },
    wildCardSlot,
  )
  return {
    battle: battles.WILD_CARD[0]!,
    slot: wildCardSlot,
    round1Index: round1Battle.index,
    side: sides[0].kind === `winner` ? 0 : 1,
    edge: HALVES.some(
      ({ dir, positions }) =>
        dir === `rtl` &&
        positions.some(position => position === wildCardSlot.position),
    )
      ? `right`
      : `left`,
    fromAbove: HALVES.some(
      ({ positions }) => positions[1] === wildCardSlot.position,
    ),
  }
}

const Half = ({
  half: { dir, positions, columns },
  finalRoarIndex,
  view,
  wildCard,
}: {
  half: HalfLayout
  finalRoarIndex: number
  view: BracketView
  wildCard: WildCardPlacement
}) => {
  const [top, bottom] = positions
  const wildCardIn = (position: DivisionPosition) =>
    position === wildCard.slot.position ? wildCard : undefined
  return (
    <>
      <Division
        dir={dir}
        className={`${columns.divisions} row-start-1`}
        position={top}
        view={view}
        wildCard={wildCardIn(top)}
      />
      <Band
        dir={dir}
        className={`${columns.divisions} row-start-2`}
        wildCard={wildCardIn(top) ?? wildCardIn(bottom)}
      />
      <Division
        dir={dir}
        className={`${columns.divisions} row-start-3`}
        position={bottom}
        view={view}
        wildCard={wildCardIn(bottom)}
      />

      <FinalRoarConnector dir={dir} column={columns.connector} />

      <div
        dir={dir}
        className={`${columns.finalRoar} row-span-3 row-start-1 flex items-center`}
      >
        <Stub />
        <LabeledBattle
          label={ROUND_NAMES.FINAL_ROAR}
          battle={view.battles.FINAL_ROAR[finalRoarIndex]!}
        />
      </div>
    </>
  )
}

// A bracket from each division's Elite Trait battle to the Final Roar, across
// the grid's rows
const FinalRoarConnector = ({
  dir,
  column,
}: {
  dir: `ltr` | `rtl`
  column: string
}) => (
  <>
    <div dir={dir} className={`${column} relative row-start-1 w-2`}>
      <div className='absolute inset-x-0 top-1/2 bottom-0 -mt-px border-e-2 border-t-2 border-ink' />
    </div>
    <div
      dir={dir}
      className={`${column} row-start-2 w-2 border-e-2 border-ink`}
    />
    <div dir={dir} className={`${column} relative row-start-3 w-2`}>
      <div className='absolute inset-x-0 top-0 bottom-1/2 -mb-px border-e-2 border-b-2 border-ink' />
    </div>
  </>
)

const Division = ({
  dir,
  className,
  position,
  view,
  wildCard,
}: {
  dir: `ltr` | `rtl`
  className: string
  position: DivisionPosition
  view: BracketView
  wildCard?: WildCardPlacement
}) => (
  <div dir={dir} className={`flex ${className}`}>
    <div className='relative w-8 shrink-0'>
      <span className='absolute top-1/2 left-1/2 -translate-1/2 -rotate-90 font-display text-2xl whitespace-nowrap text-accent-strong uppercase rtl:rotate-90'>
        {view.divisionNames[position]}
      </span>
    </div>
    <Subtree
      battle={{
        round: `ELITE_TRAIT`,
        index: DIVISION_POSITIONS.indexOf(position),
      }}
      view={view}
      wildCard={wildCard}
    />
  </div>
)

// A battle with the two battles that feed it on its outer side, down to Round
// 1. Siblings have equal heights, so the connector's ends at a quarter and
// three quarters meet their centers. Lines grow by a pixel past each mark, so
// a 2px border is centered on it
const Subtree = ({
  battle,
  view,
  wildCard,
}: {
  battle: BattleRef & { round: DivisionRound }
  view: BracketView
  wildCard?: WildCardPlacement
}) => {
  const battleView = view.battles[battle.round][battle.index]!
  if (battle.round === `ROUND_1`) {
    return <Round1Battle battle={battleView} wildCard={wildCard} />
  }
  // After Round 1, each side is the winner of an earlier battle in the
  // division
  const feeders = readBattleSides(battle, view.wildCardSlot).flatMap(side =>
    side.kind === `winner` && isDivisionRound(side.battle.round)
      ? { index: side.battle.index, round: side.battle.round }
      : [],
  )
  return (
    <div className='flex items-center'>
      <div className='flex flex-col'>
        {feeders.map(feeder => (
          <Subtree
            key={feeder.index}
            battle={feeder}
            view={view}
            wildCard={wildCard}
          />
        ))}
      </div>
      <div className='relative w-2 self-stretch'>
        <div className='absolute inset-x-0 inset-y-1/4 -my-px border-y-2 border-e-2 border-ink' />
      </div>
      <Stub />
      <BattleBox battle={battleView} size='diagram' />
    </div>
  )
}

// A Round 1 battle. Its outer padding holds the wild card's line where the
// line passes by or ends here, and matches the wild card's box
const Round1Battle = ({
  battle,
  wildCard,
}: {
  battle: BattleView
  wildCard?: WildCardPlacement
}) => {
  const lineEnd = wildCard?.round1Index === battle.index ? wildCard : undefined
  return (
    <div className={`relative py-1.5 ${ROUND_1_GUTTER}`}>
      {wildCard && isLinePassing(battle.index, wildCard) ? (
        <div className='absolute inset-y-0 start-2 border-s-2 border-ink' />
      ) : null}
      <BattleBox
        battle={battle}
        size='diagram'
        mark={
          lineEnd && {
            side: lineEnd.side,
            edge: lineEnd.edge,
            content: <WildCardLineEnd wildCard={lineEnd} />,
          }
        }
      />
    </div>
  )
}

// Whether the line passes the battle between the wild card's box and the
// battle it ends at
const isLinePassing = (
  round1Index: number,
  { round1Index: endIndex, fromAbove }: WildCardPlacement,
): boolean => (fromAbove ? round1Index < endIndex : round1Index > endIndex)

// The line's last turn, from the battle's padding edge to the middle of the
// side it fills, with an arrowhead whose tip touches the box. It's placed in
// the side's row, so it reaches past the box's 2px borders, the other side's
// 32px, and the battle's `py-1.5`
const LINE_END_CLASSES: Record<`above` | `below`, [string, string]> = {
  above: [`-top-2 bottom-1/2`, `-top-10.5 bottom-1/2`],
  below: [`top-1/2 -bottom-10.5`, `top-1/2 -bottom-2`],
}

// Outside the box's 2px border on the edge the line arrives at
const LINE_END_EDGE_CLASSES = {
  left: `right-full mr-0.5`,
  right: `left-full ml-0.5 -scale-x-100`,
}

const WildCardLineEnd = ({ wildCard }: { wildCard: WildCardPlacement }) => (
  <div
    className={`absolute w-3 border-l-2 border-ink ${LINE_END_EDGE_CLASSES[wildCard.edge]} ${LINE_END_CLASSES[wildCard.fromAbove ? `above` : `below`][wildCard.side]}`}
  >
    <svg
      viewBox='0 0 12 10'
      className={`absolute -left-0.5 h-2.5 w-3 ${wildCard.fromAbove ? `bottom-0 translate-y-1/2` : `top-0 -translate-y-1/2`}`}
    >
      <path d='M0 5H5' className='stroke-ink stroke-2' />
      <path d='M4 0 12 5 4 10Z' className='fill-ink' />
    </svg>
  </div>
)

// Between a half's divisions: the round labels, and the wild card beside its
// division. An invisible copy of the wild card's box on the far side centers
// the labels, so they line up with the other half's
const Band = ({
  dir,
  className,
  wildCard,
}: {
  dir: `ltr` | `rtl`
  className: string
  wildCard?: WildCardPlacement
}) => {
  const box = wildCard && <WildCardBox wildCard={wildCard} />
  const spacer = box && <div className='invisible'>{box}</div>
  const [above, below] = wildCard?.fromAbove ? [spacer, box] : [box, spacer]
  return (
    <div dir={dir} className={`flex flex-col ${className}`}>
      <div className='flex flex-1 flex-col justify-start'>{above}</div>
      <RoundLabels />
      <div className='flex flex-1 flex-col justify-end'>{below}</div>
    </div>
  )
}

// The label faces away from the division
const WildCardBox = ({ wildCard }: { wildCard: WildCardPlacement }) => (
  <div
    className={`flex ${wildCard.fromAbove ? `flex-col` : `flex-col-reverse`}`}
  >
    <p className='ms-13 py-1 font-condensed text-sm font-extrabold tracking-wider text-accent-strong uppercase'>
      {ROUND_NAMES.WILD_CARD} · seed {wildCard.slot.seed}
    </p>
    <div className={`relative ms-8 py-1.5 ${ROUND_1_GUTTER}`}>
      <div
        className={`absolute start-2 w-3 border-s-2 border-ink ${wildCard.fromAbove ? `top-1/2 bottom-0 -mt-px border-t-2` : `top-0 bottom-1/2 -mb-px border-b-2`}`}
      />
      <BattleBox battle={wildCard.battle} size='diagram' />
    </div>
  </div>
)

// Each label is centered over its round's boxes
const ROUND_LABEL_CLASSES: Record<DivisionRound, string> = {
  ROUND_1: `${ROUND_1_GUTTER} fill-round-1`,
  ROUND_2: `${CONNECTOR_GUTTER} fill-round-2`,
  SWEET_16: `${CONNECTOR_GUTTER} fill-sweet-16`,
  ELITE_TRAIT: `${CONNECTOR_GUTTER} fill-elite-trait`,
}

const RoundLabels = () => (
  <div className='ms-8 flex py-4'>
    {DIVISION_ROUNDS.map(round => (
      <div
        key={round}
        className={`flex flex-col items-center gap-1.5 font-condensed text-xl font-extrabold tracking-wide uppercase ${ROUND_LABEL_CLASSES[round]}`}
      >
        <svg viewBox='0 0 12 6' className='h-3 w-6'>
          <path d='M0 6 6 0 12 6Z' />
        </svg>
        {ROUND_NAMES[round]}
        <svg viewBox='0 0 12 6' className='h-3 w-6'>
          <path d='M0 0 6 6 12 0Z' />
        </svg>
        <BoxSizer />
      </div>
    ))}
  </div>
)

// The Championship between the Final Roar battles, with the champion above it
const Center = ({ view }: { view: BracketView }) => {
  const championship = view.battles.CHAMPIONSHIP[0]!
  return (
    <div className='col-start-4 row-span-3 row-start-1 flex items-center'>
      <div className='w-4 border-t-2 border-ink' />
      <div className='relative'>
        <div className='absolute bottom-full left-1/2 mb-10 flex -translate-x-1/2 flex-col items-center gap-2'>
          <p className='font-display text-xl whitespace-nowrap text-accent-strong uppercase'>
            {view.year} champion
          </p>
          <p className='min-w-48 border-4 border-ink px-3 py-2 text-center font-condensed text-lg font-extrabold uppercase'>
            {/* Keeps its height while empty */}
            {championship.winner ?? `\u{A0}`}
          </p>
        </div>
        <LabeledBattle label={ROUND_NAMES.CHAMPIONSHIP} battle={championship} />
      </div>
      <div className='w-4 border-t-2 border-ink' />
    </div>
  )
}

const LabeledBattle = ({
  label,
  battle,
}: {
  label: string
  battle: BattleView
}) => (
  <div className='relative'>
    <p className='absolute inset-x-0 bottom-full mb-1 text-center font-condensed text-sm font-extrabold tracking-wider text-accent-strong uppercase'>
      {label}
    </p>
    <BattleBox battle={battle} size='diagram' />
  </div>
)

const Stub = () => <div className='w-2 border-t-2 border-ink' />
