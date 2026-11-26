import type { Route } from './+types/contests.$contestId.ts'
import { isOpenYear } from '~/brackets.server.ts'
import { ContestDetails } from '~/components/contest-details.tsx'
import { readRequiredContest } from '~/contest-context.server.ts'
import { readContestPlayers } from '~/contest-players.server.ts'
import { countDeletedPlayers } from '~/trash.server.ts'

export const loader = async ({ context }: Route.LoaderArgs) => {
  const contest = readRequiredContest(context)
  const isOpen = await isOpenYear(contest.year)
  const [players, deletedCount] = await Promise.all([
    readContestPlayers(
      contest.id,
      isOpen ? `OLDEST_FIRST` : `HIGHEST_SCORE_FIRST`,
    ),
    countDeletedPlayers(contest.id),
  ])
  return { contest, players, deletedCount, isOpen }
}

const ContestPage = ({ loaderData }: Route.ComponentProps) => (
  <ContestDetails {...loaderData} />
)
export default ContestPage
