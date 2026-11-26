import { href, Link } from 'react-router'
import type { Route } from './+types/contests.leaderboard.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import {
  readEducatorOrganizationScope,
  readEducatorViewer,
  readRequiredLeaderboard,
} from '~/leaderboard-scopes.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

/** The educator's organization's leaderboard for the current year */
export const loader = async ({ request, context }: Route.LoaderArgs) =>
  readRequiredLeaderboard(
    request,
    await readEducatorOrganizationScope(readRequiredEducator(context).id),
    readEducatorViewer(context),
    href(`/contests`),
  )

const OrganizationLeaderboard = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <Link to={href(`/contests`)} className='self-start print:hidden'>
      All contests
    </Link>
    <PageHeader label={loaderData.name} title='Organization leaderboard' />
    <Leaderboard
      leaderboard={loaderData.leaderboard}
      reportPath={href(`/contests/report`)}
      toBracketPath={playerId =>
        href(`/contests/leaderboard/:playerId`, { playerId })
      }
    />
  </div>
)
export default OrganizationLeaderboard
