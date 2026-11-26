import { href, Link } from 'react-router'
import type { Route } from './+types/contests.year.leaderboards.$kind.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import {
  findScope,
  LEADERBOARD_TITLES,
  readEducatorScopes,
  readEducatorViewer,
  readRequiredLeaderboard,
} from '~/leaderboard-scopes.server.ts'
import { readRequiredYear } from '~/past-years.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

/** The educator's organization's leaderboard for the year, or everyone's */
export const loader = async ({
  request,
  context,
  params,
}: Route.LoaderArgs) => {
  const scopes = await readEducatorScopes(
    readRequiredEducator(context).id,
    await readRequiredYear(params.year),
  )
  const { kind, ...loaded } = await readRequiredLeaderboard(
    request,
    findScope(scopes, params.kind),
    readEducatorViewer(context),
    href(`/contests`),
  )
  return { ...loaded, title: LEADERBOARD_TITLES[kind] }
}

const YearLeaderboard = ({ loaderData, params }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <Link to={href(`/contests`)} className='self-start print:hidden'>
      All contests
    </Link>
    <PageHeader
      label={`${loaderData.year} · ${loaderData.name}`}
      title={loaderData.title}
    />
    <Leaderboard
      key={params.kind}
      leaderboard={loaderData.leaderboard}
      reportPath={href(`/contests/years/:year/report`, params)}
      toBracketPath={playerId =>
        href(`/contests/years/:year/leaderboards/:kind/:playerId`, {
          ...params,
          playerId,
        })
      }
    />
  </div>
)
export default YearLeaderboard
