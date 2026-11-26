import { href } from 'react-router'
import type { Route } from './+types/admin.reports.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { Pages } from '~/components/pages.tsx'
import { ReportList } from '~/components/report-list.tsx'
import { readPageNumber } from '~/page-number.ts'
import { readReports } from '~/reports.server.ts'

export const loader = ({ request }: Route.LoaderArgs) =>
  readReports({ kind: `admin` }, readPageNumber(request))

const AdminReports = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <PageTitle>Reports</PageTitle>
    <ReportList
      reports={loaderData.reports}
      dismissPath={href(`/admin/reports/dismiss`)}
      toLink={() => ({ to: href(`/admin/contests`), label: `See contests` })}
    />
    <Pages {...loaderData.page} />
  </div>
)
export default AdminReports
