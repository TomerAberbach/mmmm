import { BracketDiagram } from './bracket-diagram.tsx'
import { BracketRoundList, BracketRoundTabs } from './bracket-rounds.tsx'
import type { RoundSelection } from './bracket-rounds.tsx'
import { usePicking } from './picking.ts'
import type { BracketView } from '~/bracket-view.ts'

// The diagram on wide screens and on paper, and one round at a time on narrower
// screens. Screen readers read the rounds as lists beside the diagram, unless
// the bracket is being picked, which makes each box a labeled control
export const Bracket = ({
  view,
  selection,
}: {
  view: BracketView
  selection?: RoundSelection
}) => {
  const picking = usePicking()
  return (
    <>
      <div
        aria-hidden={picking ? undefined : true}
        className='hidden xl:block print:block'
      >
        <BracketDiagram view={view} />
      </div>
      {picking ? null : (
        <div className='hidden xl:sr-only xl:block print:hidden'>
          <BracketRoundList view={view} />
        </div>
      )}
      <div className='xl:hidden print:hidden'>
        <BracketRoundTabs
          view={view}
          selection={selection}
          showBattlesLeft={picking !== null}
        />
      </div>
    </>
  )
}
