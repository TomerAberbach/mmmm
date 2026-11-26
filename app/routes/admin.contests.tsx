import type { Route } from './+types/admin.contests.ts'
import { readAdminContests } from '~/admin-contests.server.ts'
import { AdminContestList } from '~/components/admin-contest-list.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { Pages } from '~/components/pages.tsx'
import { readPageNumber } from '~/page-number.ts'

export const loader = ({ request }: Route.LoaderArgs) =>
  readAdminContests(readPageNumber(request))

const AdminContests = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <PageTitle>Contests</PageTitle>
    <AdminContestList contests={loaderData.contests} />
    <Pages {...loaderData.page} />
  </div>
)
export default AdminContests
