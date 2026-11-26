import { href, redirect } from 'react-router'
import type { Route } from './+types/player.organization.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import { readPageNumber } from '~/leaderboard-row.ts'
import { readContestOrganizationScope } from '~/leaderboard-scopes.server.ts'
import { readLeaderboard } from '~/leaderboards.server.ts'
import { readPlayContest, readPlayerViewer } from '~/play-context.server.ts'

export const loader = async ({
  request,
  context,
  params,
}: Route.LoaderArgs) => {
  const named = await readContestOrganizationScope(readPlayContest(context))
  const leaderboard =
    named &&
    (await readLeaderboard(
      named.scope,
      readPlayerViewer(context),
      readPageNumber(request),
    ))
  if (!leaderboard) {
    throw redirect(href(`/player/:contestId/bracket`, params))
  }
  return { name: named.name, leaderboard }
}

const PlayerOrganization = ({ loaderData, params }: Route.ComponentProps) => (
  <>
    <PageHeader label={loaderData.name} title='Organization leaderboard' />
    <Leaderboard
      leaderboard={loaderData.leaderboard}
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
