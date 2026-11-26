import { href } from 'react-router'
import type { Route } from './+types/contests.year.leaderboards.$kind.$playerId.ts'
import { LeaderboardBracket } from '~/components/leaderboard-bracket.tsx'
import {
  findScope,
  readEducatorScopes,
  readEducatorViewer,
  readRequiredSubmission,
} from '~/leaderboard-scopes.server.ts'
import { readRequiredYear } from '~/past-years.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context, params }: Route.LoaderArgs) => {
  const scopes = await readEducatorScopes(
    readRequiredEducator(context).id,
    await readRequiredYear(params.year),
  )
  return readRequiredSubmission(
    findScope(scopes, params.kind),
    params.playerId,
    readEducatorViewer(context),
  )
}

const YearLeaderboardBracket = ({
  loaderData,
  params: { year, kind },
}: Route.ComponentProps) => (
  <LeaderboardBracket
    {...loaderData}
    leaderboardPath={href(`/contests/years/:year/leaderboards/:kind`, {
      year,
      kind,
    })}
  />
)
export default YearLeaderboardBracket
