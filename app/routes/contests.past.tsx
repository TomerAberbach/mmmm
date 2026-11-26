import { href, Link } from 'react-router'
import type { Route } from './+types/contests.past.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { PastYears } from '~/components/past-years.tsx'
import { readPastYears } from '~/past-years.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ context }: Route.LoaderArgs) =>
  readPastYears(readRequiredEducator(context).id)

const PastYearsPage = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <Link to={href(`/contests`)} className='self-start print:hidden'>
      All contests
    </Link>
    <PageTitle>Past years</PageTitle>
    <PastYears years={loaderData} />
  </div>
)
export default PastYearsPage
