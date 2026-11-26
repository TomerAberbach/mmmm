import { data } from 'react-router'
import type { Route } from './+types/contests.$contestId.ts'
import { isOpen, readCurrentYear } from '~/brackets.server.ts'
import { ContestDetails } from '~/components/contest-details.tsx'
import { readContestPlayers } from '~/contest-players.server.ts'
import { readEducatorContest } from '~/contests.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { countDeletedPlayers } from '~/trash.server.ts'

/**
 * Another educator's contest gets the not-found page, so its ID reveals nothing
 */
export const loader = async ({ context, params }: Route.LoaderArgs) => {
  // Read together, and the players stay on the server unless the contest is
  // the educator's
  const [contest, players, deletedCount, current] = await Promise.all([
    readEducatorContest(readRequiredEducator(context).id, params.contestId),
    readContestPlayers(params.contestId),
    countDeletedPlayers(params.contestId),
    readCurrentYear(),
  ])
  if (!contest) {
    throw data(null, { status: 404 })
  }
  return {
    contest,
    players,
    deletedCount,
    isOpen: isOpen(current, contest.year),
  }
}

const ContestPage = ({ loaderData }: Route.ComponentProps) => (
  <ContestDetails {...loaderData} />
)
export default ContestPage
