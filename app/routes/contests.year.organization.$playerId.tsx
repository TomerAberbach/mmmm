import { href } from 'react-router'
import type { Route } from './+types/contests.year.organization.$playerId.ts'
import { LeaderboardBracket } from '~/components/leaderboard-bracket.tsx'
import {
  readEducatorOrganizationScope,
  readEducatorViewer,
  readRequiredSubmission,
} from '~/leaderboard-scopes.server.ts'
import { readRequiredYear } from '~/past-years.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context, params }: Route.LoaderArgs) =>
  readRequiredSubmission(
    await readEducatorOrganizationScope(
      readRequiredEducator(context).id,
      await readRequiredYear(params.year),
    ),
    params.playerId,
    readEducatorViewer(context),
  )

const OrganizationLeaderboardBracket = ({
  loaderData,
  params: { year },
}: Route.ComponentProps) => (
  <LeaderboardBracket
    {...loaderData}
    leaderboardPath={href(`/contests/years/:year/organization`, { year })}
  />
)
export default OrganizationLeaderboardBracket
