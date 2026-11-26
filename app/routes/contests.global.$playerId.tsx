import { href } from 'react-router'
import type { Route } from './+types/contests.global.$playerId.ts'
import { LeaderboardBracket } from '~/components/leaderboard-bracket.tsx'
import {
  readEducatorViewer,
  readGlobalScope,
  readRequiredSubmission,
} from '~/leaderboard-scopes.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context, params }: Route.LoaderArgs) =>
  readRequiredSubmission(
    await readGlobalScope(),
    params.playerId,
    readEducatorViewer(context),
  )

const GlobalLeaderboardBracket = ({ loaderData }: Route.ComponentProps) => (
  <LeaderboardBracket
    {...loaderData}
    leaderboardPath={href(`/contests/global`)}
  />
)
export default GlobalLeaderboardBracket
