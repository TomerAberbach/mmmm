import { href, Link } from 'react-router'
import type { Route } from './+types/contests.year.organization.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import {
  readEducatorOrganizationScope,
  readEducatorViewer,
  readRequiredLeaderboard,
} from '~/leaderboard-scopes.server.ts'
import { readRequiredYear } from '~/past-years.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

/** The educator's organization's leaderboard for the year */
export const loader = async ({ request, context, params }: Route.LoaderArgs) =>
  readRequiredLeaderboard(
    request,
    await readEducatorOrganizationScope(
      readRequiredEducator(context).id,
      await readRequiredYear(params.year),
    ),
    readEducatorViewer(context),
    href(`/contests`),
  )

const OrganizationLeaderboard = ({
  loaderData,
  params,
}: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <Link to={href(`/contests`)} className='self-start print:hidden'>
      All contests
    </Link>
    <PageHeader label={loaderData.name} title='Organization leaderboard' />
    <Leaderboard
      leaderboard={loaderData.leaderboard}
      reportPath={href(`/contests/years/:year/report`, params)}
      toBracketPath={playerId =>
        href(`/contests/years/:year/organization/:playerId`, {
          ...params,
          playerId,
        })
      }
    />
  </div>
)
export default OrganizationLeaderboard
