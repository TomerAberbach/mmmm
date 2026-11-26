import { href, Link, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.leaderboard.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageHeader } from '~/components/page-header.tsx'
import { readRequiredContest } from '~/contest-context.server.ts'
import { readContestLeaderboard } from '~/leaderboards.server.ts'

export const loader = async ({ context, params }: Route.LoaderArgs) => {
  const contest = readRequiredContest(context)
  const rows = await readContestLeaderboard(contest, { sees: `everyName` })
  if (!rows) {
    throw redirect(href(`/contests/:contestId`, params))
  }
  return { name: contest.name, rows }
}

const ContestLeaderboard = ({ loaderData, params }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <Link
      to={href(`/contests/:contestId`, params)}
      className='self-start print:hidden'
    >
      {loaderData.name}
    </Link>
    <PageHeader label={loaderData.name} title='Leaderboard' />
    <Leaderboard
      rows={loaderData.rows}
      toBracketPath={playerId =>
        href(`/contests/:contestId/leaderboard/:playerId`, {
          ...params,
          playerId,
        })
      }
    />
  </div>
)
export default ContestLeaderboard
