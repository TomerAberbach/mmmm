import { href } from 'react-router'
import type { Route } from './+types/player.bracket.ts'
import { isOpenYear, readBracket, readResultRows } from '~/brackets.server.ts'
import { LockedBracket } from '~/components/locked-bracket.tsx'
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
  const [bracket, { draft, submission }, isOpen, results] = await Promise.all([
    readBracket(year),
    readDraftAndSubmission(player.id),
    isOpenYear(year),
    readResultRows(year),
  ])
  return {
    playerId: player.id,
    displayName: player.displayName,
    year,
    isOpen,
    bracket: bracket!,
    draft,
    results,
    // A player sees their personal link once they submit
    submitted: submission && {
      submission,
      personalLink: toPersonalLink(player.personalLinkSecret),
    },
  }
}

const PlayerBracketPage = ({ loaderData, params }: Route.ComponentProps) => {
  const { displayName, isOpen, draft, results, ...shared } = loaderData
  const paths = {
    forgetPath: href(`/player/:contestId/forgotten`, params),
    deletePath: href(`/player/:contestId/delete`, params),
  }
  return (
    <div className='flex flex-col gap-6'>
      <PageTitle>{`${displayName}’s bracket`}</PageTitle>
      {isOpen ? (
        <PlayerBracket
          {...shared}
          {...paths}
          initialDraft={draft}
          picksPath={href(`/player/:contestId/bracket/picks`, params)}
        />
      ) : (
        <LockedBracket {...shared} {...paths} draft={draft} results={results} />
      )}
    </div>
  )
}
export default PlayerBracketPage
