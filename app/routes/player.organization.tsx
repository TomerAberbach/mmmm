import { href } from 'react-router'
import type { Route } from './+types/player.organization.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import {
  readContestOrganizationScope,
  readRequiredLeaderboard,
} from '~/leaderboard-scopes.server.ts'
import { readPlayContest, readPlayerViewer } from '~/play-context.server.ts'

export const loader = async ({ request, context, params }: Route.LoaderArgs) =>
  readRequiredLeaderboard(
    request,
    await readContestOrganizationScope(readPlayContest(context)),
    readPlayerViewer(context),
    href(`/player/:contestId/bracket`, params),
  )

const PlayerOrganization = ({ loaderData, params }: Route.ComponentProps) => (
  <>
    <PageHeader label={loaderData.name} title='Organization leaderboard' />
    <Leaderboard
      leaderboard={loaderData.leaderboard}
      reportPath={href(`/player/:contestId/report`, params)}
      toBracketPath={playerId =>
        href(`/player/:contestId/organization/:playerId`, {
          ...params,
          playerId,
        })
      }
    />
  </>
)
export default PlayerOrganization
