import { href } from 'react-router'
import type { Route } from './+types/player.organization.$playerId.ts'
import { LeaderboardBracket } from '~/components/leaderboard-bracket.tsx'
import {
  readContestOrganizationScope,
  readRequiredSubmission,
} from '~/leaderboard-scopes.server.ts'
import { readPlayContest, readPlayerViewer } from '~/play-context.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context, params }: Route.LoaderArgs) =>
  readRequiredSubmission(
    await readContestOrganizationScope(readPlayContest(context)),
    params.playerId,
    readPlayerViewer(context),
  )

const PlayerOrganizationBracket = ({
  loaderData,
  params: { contestId },
}: Route.ComponentProps) => (
  <LeaderboardBracket
    {...loaderData}
    leaderboardPath={href(`/player/:contestId/organization`, { contestId })}
  />
)
export default PlayerOrganizationBracket
