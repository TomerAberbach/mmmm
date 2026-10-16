import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components'
import { BattleBox } from './battle-box.tsx'
import {
  describeBattle,
  readDivisionBattles,
  readStartingRound,
} from '~/bracket-view.ts'
import type { BattleView, BracketView } from '~/bracket-view.ts'
import {
  DIVISION_POSITIONS,
  isDivisionRound,
  ROUND_NAMES,
  ROUNDS,
} from '~/bracket.ts'
import type { Round } from '~/bracket.ts'

// One round at a time, for screens too narrow for the diagram
export const BracketRoundTabs = ({ view }: { view: BracketView }) => (
  <Tabs
    defaultSelectedKey={readStartingRound(view)}
    className='flex flex-col gap-6'
  >
    <TabList
      aria-label='Rounds'
      className='flex overflow-x-auto border-b-2 border-ink'
    >
      {ROUNDS.map(round => (
        <Tab
          key={round}
          id={round}
          className='-mb-0.5 flex min-h-11 shrink-0 cursor-pointer items-center border-b-4 border-transparent px-3 font-condensed text-lg font-bold whitespace-nowrap uppercase outline-none data-focus-visible:outline-3 data-focus-visible:-outline-offset-3 data-focus-visible:outline-accent-strong data-selected:border-accent data-selected:text-accent-strong'
        >
          {ROUND_NAMES[round]}
        </Tab>
      ))}
    </TabList>
    {ROUNDS.map(round => (
      <TabPanel
        key={round}
        id={round}
        className='outline-offset-4 data-focus-visible:outline-3 data-focus-visible:outline-accent-strong'
      >
        {/* The tab names the round */}
        <RoundBattles
          view={view}
          round={round}
          headingClassName='sr-only'
          showBoxes
        />
      </TabPanel>
    ))}
  </Tabs>
)

// Every round, each with a heading, for screen readers beside the diagram
export const BracketRoundList = ({ view }: { view: BracketView }) => (
  <div className='flex flex-col gap-8'>
    {ROUNDS.map(round => (
      <RoundBattles
        key={round}
        view={view}
        round={round}
        headingClassName='font-display text-2xl uppercase'
        showBoxes={false}
      />
    ))}
  </div>
)

const RoundBattles = ({
  view,
  round,
  headingClassName,
  showBoxes,
}: {
  view: BracketView
  round: Round
  headingClassName: string
  showBoxes: boolean
}) => (
  <section className='flex max-w-md flex-col gap-4'>
    <h2 className={headingClassName}>{ROUND_NAMES[round]}</h2>
    {round === `WILD_CARD` ? (
      <p>
        Its winner takes seed {view.wildCardSlot.seed} in{` `}
        {view.divisionNames[view.wildCardSlot.position]}.
      </p>
    ) : null}
    {isDivisionRound(round) ? (
      DIVISION_POSITIONS.map(position => (
        <section key={position} className='flex flex-col gap-3'>
          <h3 className='font-display text-xl text-accent-strong uppercase'>
            {view.divisionNames[position]}
          </h3>
          <BattleList
            battles={readDivisionBattles(view, round, position)}
            showBoxes={showBoxes}
          />
        </section>
      ))
    ) : (
      <BattleList battles={view.battles[round]} showBoxes={showBoxes} />
    )}
  </section>
)

const BattleList = ({
  battles,
  showBoxes,
}: {
  battles: BattleView[]
  showBoxes: boolean
}) => (
  <ol className='flex flex-col gap-3'>
    {battles.map(battle => (
      <li key={battle.index}>
        {showBoxes ? (
          <>
            <span className='sr-only'>{describeBattle(battle)}</span>
            <BattleBox battle={battle} size='regular' />
          </>
        ) : (
          describeBattle(battle)
        )}
      </li>
    ))}
  </ol>
)
