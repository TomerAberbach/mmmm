import type { Route } from './+types/play.bracket.ts'
import { readBracket } from '~/brackets.server.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { PlayerBracket } from '~/components/player-bracket.tsx'
import {
  readPlayContest,
  readRequiredPlayer,
  requirePlayer,
} from '~/play-context.server.ts'
import { readPlayerPicks } from '~/players.server.ts'

export const middleware: Route.MiddlewareFunction[] = [requirePlayer]

// The diagram needs more room than other pages
export const handle = { fullWidth: true }

export const loader = async ({ context }: Route.LoaderArgs) => {
  const player = readRequiredPlayer(context)
  const { yearId } = readPlayContest(context)
  // A contest exists only while its year's bracket is published
  const [bracket, picks] = await Promise.all([
    readBracket(yearId),
    readPlayerPicks(player.id),
  ])
  return {
    displayName: player.displayName,
    year: yearId,
    input: bracket!.input,
    picks,
  }
}

const PlayerBracketPage = ({ loaderData, params }: Route.ComponentProps) => (
  <div className='flex flex-col gap-6'>
    <PageTitle>{`${loaderData.displayName}’s bracket`}</PageTitle>
    <PlayerBracket
      year={loaderData.year}
      input={loaderData.input}
      initialPicks={loaderData.picks}
      savePath={`/play/${params.linkSecret}/bracket/picks`}
    />
  </div>
)
export default PlayerBracketPage
