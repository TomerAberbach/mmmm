import { href, Link } from 'react-router'
import type { Route } from './+types/contests.global.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import {
  readEducatorViewer,
  readGlobalScope,
  readRequiredLeaderboard,
} from '~/leaderboard-scopes.server.ts'

/** The global leaderboard for the current year */
export const loader = async ({ request, context }: Route.LoaderArgs) =>
  readRequiredLeaderboard(
    request,
    await readGlobalScope(),
    readEducatorViewer(context),
    href(`/contests`),
  )

const GlobalLeaderboard = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <Link to={href(`/contests`)} className='self-start print:hidden'>
      All contests
    </Link>
    <PageHeader label={loaderData.name} title='Global leaderboard' />
    <Leaderboard
      leaderboard={loaderData.leaderboard}
      reportPath={href(`/contests/report`)}
      toBracketPath={playerId =>
        href(`/contests/global/:playerId`, { playerId })
      }
    />
  </div>
)
export default GlobalLeaderboard
