import { href } from 'react-router'
import type { Route } from './+types/player.global.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import {
  readRequiredLeaderboard,
  toGlobalScope,
} from '~/leaderboard-scopes.server.ts'
import { readPlayContest, readPlayerViewer } from '~/play-context.server.ts'

export const loader = async ({ request, context, params }: Route.LoaderArgs) =>
  readRequiredLeaderboard(
    request,
    toGlobalScope(readPlayContest(context).year),
    readPlayerViewer(context),
    href(`/player/:contestId/bracket`, params),
  )

const PlayerGlobal = ({ loaderData, params }: Route.ComponentProps) => (
  <>
    <PageHeader label={loaderData.name} title='Global leaderboard' />
    <Leaderboard
      leaderboard={loaderData.leaderboard}
      toBracketPath={playerId =>
        href(`/player/:contestId/global/:playerId`, {
          ...params,
          playerId,
        })
      }
    />
  </>
)
export default PlayerGlobal
