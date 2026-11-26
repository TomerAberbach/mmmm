import { href, Link, Outlet } from 'react-router'
import type { Route } from './+types/player.approved.ts'
import { PlayerRanks } from '~/components/player-ranks.tsx'
import { readPlayerRanks } from '~/leaderboard-scopes.server.ts'
import {
  readPlayContest,
  readRequiredPlayer,
  requireApprovedPlayer,
} from '~/play-context.server.ts'

/** Pages below are only for a player whose submission is approved */
export const middleware: Route.MiddlewareFunction[] = [requireApprovedPlayer]

export const loader = ({ context }: Route.LoaderArgs) =>
  readPlayerRanks(readPlayContest(context), readRequiredPlayer(context).id)

const ApprovedPlayerRoute = ({ loaderData, params }: Route.ComponentProps) => (
  <div className='flex flex-col gap-6'>
    <Link
      to={href(`/player/:contestId/bracket`, params)}
      className='self-start print:hidden'
    >
      My bracket
    </Link>
    <PlayerRanks contestId={params.contestId} ranks={loaderData} />
    <Outlet />
  </div>
)
export default ApprovedPlayerRoute
