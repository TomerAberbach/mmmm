import { href, Link } from 'react-router'
import type { Route } from './+types/contests.year.global.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import {
  readEducatorViewer,
  readRequiredLeaderboard,
  toGlobalScope,
} from '~/leaderboard-scopes.server.ts'
import { readRequiredYear } from '~/past-years.server.ts'

/** The global leaderboard for the year */
export const loader = async ({ request, context, params }: Route.LoaderArgs) =>
  readRequiredLeaderboard(
    request,
    toGlobalScope(await readRequiredYear(params.year)),
    readEducatorViewer(context),
    href(`/contests`),
  )

const GlobalLeaderboard = ({ loaderData, params }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <Link to={href(`/contests`)} className='self-start print:hidden'>
      All contests
    </Link>
    <PageHeader
      label={`${loaderData.year} · ${loaderData.name}`}
      title='Global leaderboard'
    />
    <Leaderboard
      leaderboard={loaderData.leaderboard}
      reportPath={href(`/contests/years/:year/report`, params)}
      toBracketPath={playerId =>
        href(`/contests/years/:year/global/:playerId`, { ...params, playerId })
      }
    />
  </div>
)
export default GlobalLeaderboard
