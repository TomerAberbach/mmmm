import { href } from 'react-router'
import type { Route } from './+types/contests.year.global.$playerId.ts'
import { LeaderboardBracket } from '~/components/leaderboard-bracket.tsx'
import {
  readEducatorViewer,
  readRequiredSubmission,
  toGlobalScope,
} from '~/leaderboard-scopes.server.ts'
import { readRequiredYear } from '~/past-years.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context, params }: Route.LoaderArgs) =>
  readRequiredSubmission(
    toGlobalScope(await readRequiredYear(params.year)),
    params.playerId,
    readEducatorViewer(context),
  )

const GlobalLeaderboardBracket = ({
  loaderData,
  params: { year },
}: Route.ComponentProps) => (
  <LeaderboardBracket
    {...loaderData}
    leaderboardPath={href(`/contests/years/:year/global`, { year })}
  />
)
export default GlobalLeaderboardBracket
