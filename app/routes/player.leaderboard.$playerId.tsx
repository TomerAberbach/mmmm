import { href } from 'react-router'
import type { Route } from './+types/player.leaderboard.$playerId.ts'
import { LeaderboardBracket } from '~/components/leaderboard-bracket.tsx'
import {
  readRequiredSubmission,
  toContestScope,
} from '~/leaderboard-scopes.server.ts'
import { readPlayContest, readPlayerViewer } from '~/play-context.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context, params }: Route.LoaderArgs) =>
  readRequiredSubmission(
    toContestScope(readPlayContest(context)),
    params.playerId,
    readPlayerViewer(context),
  )

const PlayerLeaderboardBracket = ({
  loaderData,
  params: { contestId },
}: Route.ComponentProps) => (
  <LeaderboardBracket
    {...loaderData}
    leaderboardPath={href(`/player/:contestId/leaderboard`, { contestId })}
  />
)
export default PlayerLeaderboardBracket
