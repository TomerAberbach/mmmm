import { href, redirect } from 'react-router'
import type { Route } from './+types/player.leaderboard.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { readPageNumber } from '~/leaderboard-row.ts'
import { toContestScope } from '~/leaderboard-scopes.server.ts'
import { readLeaderboard } from '~/leaderboards.server.ts'
import { readPlayContest, readPlayerViewer } from '~/play-context.server.ts'

export const loader = async ({
  request,
  context,
  params,
}: Route.LoaderArgs) => {
  const named = toContestScope(readPlayContest(context))
  const leaderboard = await readLeaderboard(
    named.scope,
    readPlayerViewer(context),
    readPageNumber(request),
  )
  if (!leaderboard) {
    throw redirect(href(`/player/:contestId/bracket`, params))
  }
  return leaderboard
}

const PlayerLeaderboard = ({ loaderData, params }: Route.ComponentProps) => (
  <>
    <PageTitle>Leaderboard</PageTitle>
    <Leaderboard
      leaderboard={loaderData}
      toBracketPath={playerId =>
        href(`/player/:contestId/leaderboard/:playerId`, {
          ...params,
          playerId,
        })
      }
    />
  </>
)
export default PlayerLeaderboard
