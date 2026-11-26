import { href, Link, redirect } from 'react-router'
import type { Route } from './+types/player.leaderboard.ts'
import { Leaderboard } from '~/components/leaderboard.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { readContestLeaderboard } from '~/leaderboards.server.ts'
import { readPlayContest, readRequiredPlayer } from '~/play-context.server.ts'

export const loader = async ({ context, params }: Route.LoaderArgs) => {
  const rows = await readContestLeaderboard(readPlayContest(context), {
    sees: `topNames`,
    ownPlayerId: readRequiredPlayer(context).id,
  })
  if (!rows) {
    throw redirect(href(`/player/:contestId/bracket`, params))
  }
  return rows
}

const PlayerLeaderboard = ({ loaderData, params }: Route.ComponentProps) => (
  <div className='flex flex-col gap-6'>
    <Link
      to={href(`/player/:contestId/bracket`, params)}
      className='self-start print:hidden'
    >
      My bracket
    </Link>
    <PageTitle>Leaderboard</PageTitle>
    <Leaderboard
      rows={loaderData}
      toBracketPath={playerId =>
        href(`/player/:contestId/leaderboard/:playerId`, {
          ...params,
          playerId,
        })
      }
    />
  </div>
)
export default PlayerLeaderboard
