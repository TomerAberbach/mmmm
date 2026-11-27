import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.results.ts'
import { readAdminYears, readBracketAndResults } from '~/brackets.server.ts'
import { CombatantMoves } from '~/components/combatant-moves.tsx'
import { CombatantRenames } from '~/components/combatant-renames.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { PhaseSection } from '~/components/phase-section.tsx'
import { ResultsEditor } from '~/components/results-editor.tsx'
import { readArrangement } from '~/moves.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

/** The current year's results, then its combatants' names */
export const loader = async () => {
  const { current } = await readAdminYears()
  if (!current) {
    return redirect(href(`/admin`))
  }
  const { year, summary } = current
  return { year, summary, ...(await readBracketAndResults(year)) }
}

const AdminResults = ({
  loaderData: { year, summary, bracket, results },
}: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <div className='mx-auto flex w-full max-w-page flex-col gap-8'>
      <PageTitle>{`${year} bracket`}</PageTitle>
      <PhaseSection year={year} summary={summary} />
    </div>
    <ResultsEditor
      // A move can clear results, so the editor starts again from the saved ones
      key={`${year} ${readArrangement(bracket)}`}
      year={year}
      bracket={bracket}
      initialResults={results}
      isLocked={summary.phase !== `OPEN`}
    />
    <div className='mx-auto flex w-full max-w-page flex-col gap-8'>
      <CombatantRenames year={year} bracket={bracket} />
      <CombatantMoves
        key={year}
        year={year}
        bracket={bracket}
        isLocked={summary.phase !== `OPEN`}
      />
    </div>
  </div>
)
export default AdminResults
