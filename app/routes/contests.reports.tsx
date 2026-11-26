import { href, Link } from 'react-router'
import type { Route } from './+types/contests.reports.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { Pages } from '~/components/pages.tsx'
import { ReportList } from '~/components/report-list.tsx'
import { readPageNumber } from '~/page-number.ts'
import { readReports } from '~/reports.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ request, context }: Route.LoaderArgs) =>
  readReports(
    { kind: `educator`, educatorId: readRequiredEducator(context).id },
    readPageNumber(request),
  )

const ContestsReports = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <Link to={href(`/contests`)} className='self-start print:hidden'>
      All contests
    </Link>
    <PageTitle>Reports</PageTitle>
    <ReportList
      reports={loaderData.reports}
      dismissPath={href(`/contests/reports/dismiss`)}
      toLink={({ contest }) => ({
        to: href(`/contests/:contestId`, { contestId: contest.id }),
        label: `See the contest`,
      })}
    />
    <Pages {...loaderData.page} />
  </div>
)
export default ContestsReports
