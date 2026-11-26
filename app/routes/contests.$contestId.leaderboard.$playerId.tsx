import { href } from 'react-router'
import type { Route } from './+types/contests.$contestId.leaderboard.$playerId.ts'
import { LeaderboardBracket } from '~/components/leaderboard-bracket.tsx'
import { readViewableContest } from '~/contest-context.server.ts'
import {
  readEducatorViewer,
  readRequiredSubmission,
  toContestScope,
} from '~/leaderboard-scopes.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context, params }: Route.LoaderArgs) =>
  readRequiredSubmission(
    toContestScope(readViewableContest(context).contest),
    params.playerId,
    readEducatorViewer(context),
  )

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
