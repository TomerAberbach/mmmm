import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Bracket } from './bracket.tsx'
import { Scoreboard } from './scoreboard.tsx'
import { buildMarkedBracketView } from '~/bracket-view.ts'
import type { Picks } from '~/picks.ts'
import type { Results } from '~/results.ts'
import { readScorecard } from '~/scorecard.ts'
import { toSeededBracket } from '~/seeded-bracket.ts'
import type { StoredBracket } from '~/seeded-bracket.ts'

/**
 * A submission's score, then its picks marked against the results. `children`
 * go between them
 */
export const MarkedBracket = ({
  year,
  bracket,
  picks,
  results,
  children,
}: {
  year: number
  bracket: StoredBracket
  picks: Picks
  results: Results
  children?: ReactNode
}) => {
  const view = useMemo(
    () =>
      buildMarkedBracketView(year, toSeededBracket(bracket), picks, results),
    [year, bracket, picks, results],
  )
  return (
    <>
      <Scoreboard scorecard={readScorecard(view)} />
      {children}
      <div className='print:page-landscape'>
        <Bracket view={view} />
      </div>
    </>
  )
}
