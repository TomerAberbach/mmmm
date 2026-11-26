import type { Route } from './+types/admin.contests.ts'
import { readAdminContests } from '~/admin-contests.server.ts'
import { readCurrentYear } from '~/brackets.server.ts'
import { AdminContestList } from '~/components/admin-contest-list.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { Pages } from '~/components/pages.tsx'
import { readPageNumber } from '~/page-number.ts'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const current = await readCurrentYear()
  return (
    current && (await readAdminContests(current.year, readPageNumber(request)))
  )
}

const AdminContests = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <PageTitle>Contests</PageTitle>
    <AdminContestList contests={loaderData?.contests ?? []} />
    {loaderData ? <Pages {...loaderData.page} /> : null}
  </div>
)
export default AdminContests
