import { href } from 'react-router'
import type { Route } from './+types/player.bracket.ts'
import { readBracket } from '~/brackets.server.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { PlayerBracket } from '~/components/player-bracket.tsx'
import {
  readPlayContest,
  readRequiredPlayer,
  requirePlayer,
} from '~/play-context.server.ts'
import { readDraftAndSubmission } from '~/player-picks.server.ts'
import { toPersonalLink } from '~/players.server.ts'

export const middleware: Route.MiddlewareFunction[] = [requirePlayer]

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context }: Route.LoaderArgs) => {
  const player = readRequiredPlayer(context)
  const { year } = readPlayContest(context)
  // A contest exists only while its year's bracket is published
  const [bracket, { draft, submission }] = await Promise.all([
    readBracket(year),
    readDraftAndSubmission(player.id),
  ])
  return {
    playerId: player.id,
    displayName: player.displayName,
    year,
    bracket: bracket!,
    draft,
    // A player sees their personal link once they submit
    submitted: submission && {
      submission,
      personalLink: toPersonalLink(player.personalLinkSecret),
    },
  }
}

const PlayerBracketPage = ({ loaderData, params }: Route.ComponentProps) => (
  <div className='flex flex-col gap-6'>
    <PageTitle>{`${loaderData.displayName}’s bracket`}</PageTitle>
    <PlayerBracket
      year={loaderData.year}
      bracket={loaderData.bracket}
      initialDraft={loaderData.draft}
      submitted={loaderData.submitted}
      picksPath={href(`/player/:contestId/bracket/picks`, params)}
      forgetPath={href(`/player/:contestId/forgotten`, params)}
      playerId={loaderData.playerId}
      deletePath={href(`/player/:contestId/delete`, params)}
    />
  </div>
)
export default PlayerBracketPage
