import { href } from 'react-router'
import type { Route } from './+types/player.bracket.ts'
import { LockedBracket } from '~/components/locked-bracket.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { PlayerBracket } from '~/components/player-bracket.tsx'
import { PlayerRanks } from '~/components/player-ranks.tsx'
import { readPlayerRanks } from '~/leaderboard-scopes.server.ts'
import { readArrangement } from '~/moves.ts'
import { readPastYear } from '~/past-years.server.ts'
import { readPlayContest, readRequiredPlayer } from '~/play-context.server.ts'
import { readPlayerBracket } from '~/player-picks.server.ts'
import { toPersonalLink } from '~/players.server.ts'
import { isOpenYear } from '~/years.server.ts'

/** The diagram needs more room than other pages */
export const handle = { fullWidth: true }

export const loader = async ({ context }: Route.LoaderArgs) => {
  const player = readRequiredPlayer(context)
  const contest = readPlayContest(context)
  const { year } = contest
  // A contest exists only while its year's bracket is published
  const [
    { bracket, results, draft, submission, hasClearedPicks },
    isOpen,
    pastYear,
  ] = await Promise.all([
    readPlayerBracket(player.id, year),
    isOpenYear(year),
    readPastYear(year),
  ])
  const ranks =
    !isOpen && submission?.status === `APPROVED`
      ? await readPlayerRanks(contest, player.id)
      : null
  return {
    ranks,
    playerId: player.id,
    displayName: player.displayName,
    year,
    isOpen,
    isPast: pastYear !== null,
    isOrphaned: contest.educatorName === null,
    bracket,
    draft,
    results,
    hasClearedPicks,
    // A player sees their personal link once they submit
    submitted: submission && {
      submission,
      personalLink: toPersonalLink(player.personalLinkSecret),
    },
  }
}

const PlayerBracketPage = ({ loaderData, params }: Route.ComponentProps) => {
  const {
    displayName,
    isOpen,
    draft,
    results,
    hasClearedPicks,
    ranks,
    isPast,
    ...shared
  } = loaderData
  const paths = {
    forgetPath: href(`/player/:contestId/forgotten`, params),
    deletePath: href(`/player/:contestId/delete`, params),
  }
  return (
    <div className='flex flex-col gap-6'>
      <PageTitle>{`${displayName}’s bracket`}</PageTitle>
      {isOpen ? (
        <PlayerBracket
          // A move can clear picks, and the browser may remember another player
          // by the next load, so the picker starts again from the saved picks
          key={`${shared.playerId} ${readArrangement(shared.bracket)}`}
          {...shared}
          {...paths}
          initialDraft={draft}
          hasClearedPicks={hasClearedPicks}
          picksPath={href(`/player/:contestId/bracket/picks`, params)}
        />
      ) : (
        <LockedBracket
          {...shared}
          {...paths}
          isPast={isPast}
          draft={draft}
          results={results}
          ranks={
            ranks && <PlayerRanks contestId={params.contestId} ranks={ranks} />
          }
        />
      )}
    </div>
  )
}
export default PlayerBracketPage
