import { data, href, Link } from 'react-router'
import type { Route } from './+types/admin.contests.$contestId.ts'
import { readAdminContest } from '~/admin-contests.server.ts'
import {
  AdminContestActions,
  describeAdminContest,
} from '~/components/admin-contest-actions.tsx'
import { AdminPlayerList } from '~/components/admin-player-list.tsx'
import { PageHeader } from '~/components/page-header.tsx'

export const loader = async ({ params }: Route.LoaderArgs) => {
  const contest = await readAdminContest(params.contestId)
  if (!contest) {
    throw data(null, { status: 404 })
  }
  return contest
}

const AdminContest = ({
  loaderData: { contest, players },
  params,
}: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <Link to={href(`/admin/contests`)} className='self-start'>
      Contests
    </Link>
    <div className='flex flex-col gap-2'>
      <PageHeader
        title={contest.name}
        action={<AdminContestActions contest={contest} />}
      />
      <p className='wrap-anywhere text-muted'>
        {describeAdminContest(contest)}
      </p>
    </div>
    <AdminPlayerList
      players={players}
      action={href(`/admin/contests/:contestId/erase`, params)}
    />
  </div>
)
export default AdminContest
