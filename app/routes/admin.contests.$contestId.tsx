import { data, href, Link } from 'react-router'
import type { Route } from './+types/admin.contests.$contestId.ts'
import { readAdminContest } from '~/admin-contests.server.ts'
import { AdminContestHeader } from '~/components/admin-contest-header.tsx'
import { AdminPlayerList } from '~/components/admin-player-list.tsx'
import { EraseContestDialog } from '~/components/erase-contest-dialog.tsx'

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
    <AdminContestHeader contest={contest} />
    <AdminPlayerList
      players={players}
      action={href(`/admin/contests/:contestId/erase`, params)}
    />
    <div className='border-t-2 border-ink pt-4'>
      <EraseContestDialog
        contest={{ ...contest, playerCount: players.length }}
      />
    </div>
  </div>
)
export default AdminContest
