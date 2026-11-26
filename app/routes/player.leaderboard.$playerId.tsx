import { data, href } from 'react-router'
import type { Route } from './+types/player.leaderboard.$playerId.ts'
import { LeaderboardBracket } from '~/components/leaderboard-bracket.tsx'
import { readLeaderboardSubmission } from '~/leaderboards.server.ts'
import { readPlayContest, readRequiredPlayer } from '~/play-context.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context, params }: Route.LoaderArgs) => {
  const contest = readPlayContest(context)
  const submission = await readLeaderboardSubmission(contest, params.playerId, {
    sees: `topNames`,
    ownPlayerId: readRequiredPlayer(context).id,
  })
  if (!submission) {
    throw data(null, { status: 404 })
  }
  return { submission, contest: { name: contest.name, year: contest.year } }
}

const PlayerLeaderboardBracket = ({
  loaderData,
  params: { contestId },
}: Route.ComponentProps) => (
  <LeaderboardBracket
    {...loaderData}
    leaderboardPath={href(`/player/:contestId/leaderboard`, { contestId })}
  />
)
export default PlayerLeaderboardBracket
