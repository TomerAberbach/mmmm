import { href } from 'react-router'
import type { Route } from './+types/player.leaderboards.$kind.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import {
  findScope,
  LEADERBOARD_TITLES,
  readPlayerScopes,
  readRequiredLeaderboard,
} from '~/leaderboard-scopes.server.ts'
import { readPlayContest, readPlayerViewer } from '~/play-context.server.ts'

export const loader = async ({
  request,
  context,
  params,
}: Route.LoaderArgs) => {
  const { kind, name, ...loaded } = await readRequiredLeaderboard(
    request,
    findScope(await readPlayerScopes(readPlayContest(context)), params.kind),
    readPlayerViewer(context),
    href(`/player/:contestId/bracket`, params),
  )
  return {
    ...loaded,
    title: LEADERBOARD_TITLES[kind],
    // Every player page names the contest already
    label: kind === `contest` ? null : name,
  }
}

const PlayerLeaderboard = ({ loaderData, params }: Route.ComponentProps) => (
  <>
    <PageHeader
      {...(loaderData.label !== null && { label: loaderData.label })}
      title={loaderData.title}
    />
    <Leaderboard
      key={params.kind}
      leaderboard={loaderData.leaderboard}
      reportPath={href(`/player/:contestId/report`, params)}
      toBracketPath={playerId =>
        href(`/player/:contestId/leaderboards/:kind/:playerId`, {
          ...params,
          playerId,
        })
      }
    />
  </>
)
export default PlayerLeaderboard
