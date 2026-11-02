import type { Route } from './+types/play.bracket.ts'
import { readBracket } from '~/brackets.server.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { PlayerBracket } from '~/components/player-bracket.tsx'
import { toAppUrl } from '~/env.server.ts'
import { toForgottenPath, toPersonalLinkPath, toPicksPath } from '~/paths.ts'
import {
  readPlayContest,
  readRequiredPlayer,
  requirePlayer,
} from '~/play-context.server.ts'
import { readDraftAndSubmission } from '~/player-picks.server.ts'

export const middleware: Route.MiddlewareFunction[] = [requirePlayer]

// The diagram needs more room than other pages
export const handle = { fullWidth: true }

export const loader = async ({ context }: Route.LoaderArgs) => {
  const player = readRequiredPlayer(context)
  const { yearId } = readPlayContest(context)
  // A contest exists only while its year's bracket is published
  const [input, { draft, submission }] = await Promise.all([
    readBracket(yearId),
    readDraftAndSubmission(player.id),
  ])
  return {
    displayName: player.displayName,
    year: yearId,
    input: input!,
    draft,
    // A player sees their personal link once they submit
    submitted: submission && {
      submission,
      personalLink: toAppUrl(toPersonalLinkPath(player.personalLinkSecret))
        .href,
    },
  }
}

const PlayerBracketPage = ({ loaderData, params }: Route.ComponentProps) => (
  <div className='flex flex-col gap-6'>
    <PageTitle>{`${loaderData.displayName}’s bracket`}</PageTitle>
    <PlayerBracket
      year={loaderData.year}
      input={loaderData.input}
      initialDraft={loaderData.draft}
      submitted={loaderData.submitted}
      picksPath={toPicksPath(params.linkSecret)}
      forgetPath={toForgottenPath(params.linkSecret)}
    />
  </div>
)
export default PlayerBracketPage
