import { href, Link } from 'react-router'
import type { Route } from './+types/contests.$contestId.leaderboard.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import { readViewableContest } from '~/contest-context.server.ts'
import {
  readEducatorViewer,
  readRequiredLeaderboard,
  toContestScope,
} from '~/leaderboard-scopes.server.ts'

export const loader = async ({
  request,
  context,
  params,
}: Route.LoaderArgs) => {
  const { access, contest } = readViewableContest(context)
  return {
    access,
    ...(await readRequiredLeaderboard(
      request,
      toContestScope(contest),
      readEducatorViewer(context),
      href(`/contests/:contestId`, params),
    )),
  }
}

const ContestLeaderboard = ({ loaderData, params }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <Link
      to={href(`/contests/:contestId`, params)}
      className='self-start print:hidden'
    >
      {loaderData.name}
    </Link>
    <PageHeader label={loaderData.name} title='Leaderboard' />
    <Leaderboard
      leaderboard={loaderData.leaderboard}
      reportPath={
        loaderData.access === `shared`
          ? href(`/contests/:contestId/report`, params)
          : null
      }
      toBracketPath={playerId =>
        href(`/contests/:contestId/leaderboard/:playerId`, {
          ...params,
          playerId,
        })
      }
    />
  </div>
)
export default ContestLeaderboard
