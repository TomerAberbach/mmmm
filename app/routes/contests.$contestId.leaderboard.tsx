import { href, Link, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.leaderboard.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import { readViewableContest } from '~/contest-context.server.ts'
import { readPageNumber } from '~/leaderboard-row.ts'
import {
  readEducatorViewer,
  toContestScope,
} from '~/leaderboard-scopes.server.ts'
import { readLeaderboard } from '~/leaderboards.server.ts'

export const loader = async ({
  request,
  context,
  params,
}: Route.LoaderArgs) => {
  const named = toContestScope(readViewableContest(context).contest)
  const leaderboard = await readLeaderboard(
    named.scope,
    readEducatorViewer(context),
    readPageNumber(request),
  )
  if (!leaderboard) {
    throw redirect(href(`/contests/:contestId`, params))
  }
  return { name: named.name, leaderboard }
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
