import { data, href, Link } from 'react-router'
import type { Route } from './+types/admin.contests.$contestId.ts'
import { readAdminPlayers } from '~/admin-contests.server.ts'
import { AdminPlayerList } from '~/components/admin-player-list.tsx'
import { PageHeader } from '~/components/page-header.tsx'

export const loader = async ({ params }: Route.LoaderArgs) => {
  const contest = await readAdminPlayers(params.contestId)
  if (!contest) {
    throw data(null, { status: 404 })
  }
  return contest
}

const AdminContest = ({ loaderData, params }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <Link to={href(`/admin/contests`)} className='self-start'>
      Contests
    </Link>
    <PageHeader label={String(loaderData.year)} title={loaderData.name} />
    <AdminPlayerList
      players={loaderData.players}
      action={href(`/admin/contests/:contestId/erase`, params)}
    />
  </div>
)
export default AdminContest
