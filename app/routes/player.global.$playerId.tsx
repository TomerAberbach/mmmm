import { href } from 'react-router'
import type { Route } from './+types/player.global.$playerId.ts'
import { LeaderboardBracket } from '~/components/leaderboard-bracket.tsx'
import {
  readRequiredSubmission,
  toGlobalScope,
} from '~/leaderboard-scopes.server.ts'
import { readPlayContest, readPlayerViewer } from '~/play-context.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context, params }: Route.LoaderArgs) =>
  readRequiredSubmission(
    toGlobalScope(readPlayContest(context).year),
    params.playerId,
    readPlayerViewer(context),
  )

const PlayerGlobalBracket = ({
  loaderData,
  params: { contestId },
}: Route.ComponentProps) => (
  <LeaderboardBracket
    {...loaderData}
    leaderboardPath={href(`/player/:contestId/global`, { contestId })}
  />
)
export default PlayerGlobalBracket
