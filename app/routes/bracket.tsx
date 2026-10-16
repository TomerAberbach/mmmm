import { data } from 'react-router'
import type { Route } from './+types/bracket.ts'
import { buildBracketView } from '~/bracket-view.ts'
import { readCurrentBracket } from '~/brackets.server.ts'
import { Bracket } from '~/components/bracket.tsx'
import { PageTitle } from '~/components/page-title.tsx'

// The diagram needs more room than other pages
export const handle = { fullWidth: true }

export const loader = async () => {
  const bracket = await readCurrentBracket()
  if (!bracket) {
    throw data(null, { status: 404 })
  }
  return buildBracketView(bracket.year, bracket.input, [])
}

const BracketPage = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8 page-landscape'>
    <div className='text-center'>
      <PageTitle>{`${loaderData.year} bracket`}</PageTitle>
    </div>
    <Bracket view={loaderData} />
  </div>
)
export default BracketPage
