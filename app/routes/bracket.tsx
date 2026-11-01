import { data } from 'react-router'
import type { Route } from './+types/bracket.ts'
import { Bracket } from '~/components/bracket.tsx'
import { LockHeadsUp } from '~/components/lock-heads-up.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { readCurrentBracketView } from '~/current-bracket.server.ts'

// The diagram needs more room than other pages
export const handle = { fullWidth: true }

export const loader = async () => {
  const current = await readCurrentBracketView()
  if (!current) {
    throw data(null, { status: 404 })
  }
  return current
}

const BracketPage = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8 page-landscape'>
    <div className='flex flex-col items-center gap-3 text-center'>
      <PageTitle>{`${loaderData.view.year} bracket`}</PageTitle>
      {loaderData.expectedLockDate ? (
        <LockHeadsUp expectedLockDate={loaderData.expectedLockDate} />
      ) : null}
    </div>
    <Bracket view={loaderData.view} />
  </div>
)
export default BracketPage
