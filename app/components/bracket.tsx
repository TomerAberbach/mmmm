import { BracketDiagram } from './bracket-diagram.tsx'
import { BracketRoundList, BracketRoundTabs } from './bracket-rounds.tsx'
import type { BracketView } from '~/bracket-view.ts'

// The diagram on wide screens and on paper, and one round at a time on narrower
// screens. Screen readers read the rounds as lists beside the diagram
export const Bracket = ({ view }: { view: BracketView }) => (
  <>
    <div className='hidden xl:block print:block'>
      <BracketDiagram view={view} />
    </div>
    <div className='hidden xl:sr-only xl:block print:hidden'>
      <BracketRoundList view={view} />
    </div>
    <div className='xl:hidden print:hidden'>
      <BracketRoundTabs view={view} />
    </div>
  </>
)
