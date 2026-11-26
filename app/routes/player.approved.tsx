import { href, Outlet } from 'react-router'
import type { Route } from './+types/player.approved.ts'
import { LeaderboardNav } from '~/components/leaderboard-nav.tsx'
import { readContestOrganizationScope } from '~/leaderboard-scopes.server.ts'
import {
  readPlayContest,
  requireApprovedPlayer,
} from '~/play-context.server.ts'

/** Pages below are only for a player whose submission is approved */
export const middleware: Route.MiddlewareFunction[] = [requireApprovedPlayer]

export const loader = async ({ context }: Route.LoaderArgs) => {
  const contest = readPlayContest(context)
  const named = await readContestOrganizationScope(contest)
  return {
    contestName: contest.name,
    organizationName: named?.name ?? null,
  }
}

const ApprovedPlayerRoute = ({ loaderData, params }: Route.ComponentProps) => (
  <div className='flex flex-col gap-6'>
    <LeaderboardNav
      links={[
        { to: href(`/player/:contestId/bracket`, params), label: `My bracket` },
        {
          to: href(`/player/:contestId/leaderboard`, params),
          label: loaderData.contestName,
        },
        ...(loaderData.organizationName === null
          ? []
          : [
              {
                to: href(`/player/:contestId/organization`, params),
                label: loaderData.organizationName,
              },
            ]),
      ]}
    />
    <Outlet />
  </div>
)
export default ApprovedPlayerRoute
