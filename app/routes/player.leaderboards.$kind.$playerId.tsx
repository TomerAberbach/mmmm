import { href } from 'react-router'
import type { Route } from './+types/player.leaderboards.$kind.$playerId.ts'
import { LeaderboardBracket } from '~/components/leaderboard-bracket.tsx'
import {
  findScope,
  readPlayerScopes,
  readRequiredSubmission,
} from '~/leaderboard-scopes.server.ts'
import { readPlayContest, readPlayerViewer } from '~/play-context.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context, params }: Route.LoaderArgs) =>
  readRequiredSubmission(
    findScope(await readPlayerScopes(readPlayContest(context)), params.kind),
    params.playerId,
    readPlayerViewer(context),
  )

const PlayerLeaderboardBracket = ({
  loaderData,
  params: { contestId, kind },
}: Route.ComponentProps) => (
  <LeaderboardBracket
    {...loaderData}
    leaderboardPath={href(`/player/:contestId/leaderboards/:kind`, {
      contestId,
      kind,
    })}
  />
)
export default PlayerLeaderboardBracket
