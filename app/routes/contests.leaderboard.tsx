import { href, Link, redirect } from 'react-router'
import type { Route } from './+types/contests.leaderboard.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import { readPageNumber } from '~/leaderboard-row.ts'
import {
  readEducatorOrganizationScope,
  readEducatorViewer,
} from '~/leaderboard-scopes.server.ts'
import { readLeaderboard } from '~/leaderboards.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

/** The educator's organization's leaderboard for the current year */
export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const named = await readEducatorOrganizationScope(
    readRequiredEducator(context).id,
  )
  const leaderboard =
    named &&
    (await readLeaderboard(
      named.scope,
      readEducatorViewer(context),
      readPageNumber(request),
    ))
  if (!leaderboard) {
    throw redirect(href(`/contests`))
  }
  return { name: named.name, leaderboard }
}

const OrganizationLeaderboard = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <Link to={href(`/contests`)} className='self-start print:hidden'>
      All contests
    </Link>
    <PageHeader label={loaderData.name} title='Organization leaderboard' />
    <Leaderboard
      leaderboard={loaderData.leaderboard}
      toBracketPath={playerId =>
        href(`/contests/leaderboard/:playerId`, { playerId })
      }
    />
  </div>
)
export default OrganizationLeaderboard
