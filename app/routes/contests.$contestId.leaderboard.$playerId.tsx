import { data, href } from 'react-router'
import type { Route } from './+types/contests.$contestId.leaderboard.$playerId.ts'
import { LeaderboardBracket } from '~/components/leaderboard-bracket.tsx'
import { readRequiredContest } from '~/contest-context.server.ts'
import { readLeaderboardSubmission } from '~/leaderboards.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({
  context,
  params: { playerId },
}: Route.LoaderArgs) => {
  const contest = readRequiredContest(context)
  const submission = await readLeaderboardSubmission(contest, playerId, {
    sees: `everyName`,
  })
  if (!submission) {
    throw data(null, { status: 404 })
  }
  return { submission, contest: { name: contest.name, year: contest.year } }
}

const ContestLeaderboardBracket = ({
  loaderData,
  params: { contestId },
}: Route.ComponentProps) => (
  <LeaderboardBracket
    {...loaderData}
    leaderboardPath={href(`/contests/:contestId/leaderboard`, { contestId })}
  />
)
export default ContestLeaderboardBracket
