import { href } from 'react-router'
import type { Route } from './+types/player.leaderboard.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import {
  readRequiredLeaderboard,
  toContestScope,
} from '~/leaderboard-scopes.server.ts'
import { readPlayContest, readPlayerViewer } from '~/play-context.server.ts'

export const loader = async ({ request, context, params }: Route.LoaderArgs) =>
  readRequiredLeaderboard(
    request,
    toContestScope(readPlayContest(context)),
    readPlayerViewer(context),
    href(`/player/:contestId/bracket`, params),
  )

const PlayerLeaderboard = ({ loaderData, params }: Route.ComponentProps) => (
  <>
    <PageTitle>Leaderboard</PageTitle>
    <Leaderboard
      leaderboard={loaderData.leaderboard}
      reportPath={href(`/player/:contestId/report`, params)}
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
