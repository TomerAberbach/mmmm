import type { Route } from './+types/contests.$contestId.ts'
import { isOpenYear } from '~/brackets.server.ts'
import { ContestDetails } from '~/components/contest-details.tsx'
import { SharedContestDetails } from '~/components/shared-contest.tsx'
import { readViewableContest } from '~/contest-context.server.ts'
import { readContestPlayers } from '~/contest-players.server.ts'
import { readContestOrganization } from '~/organizations.server.ts'
import { readColleagues } from '~/shares.server.ts'
import { countDeletedPlayers } from '~/trash.server.ts'

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { access, contest } = readViewableContest(context)
  const isOpen = await isOpenYear(contest.year)
  const readPlayers = () =>
    readContestPlayers(
      contest.id,
      isOpen ? `OLDEST_FIRST` : `HIGHEST_SCORE_FIRST`,
    )
  if (access === `shared`) {
    return { access, contest, isOpen, players: await readPlayers() }
  }
  const [players, deletedCount, organization, colleagues] = await Promise.all([
    readPlayers(),
    countDeletedPlayers(contest.id),
    readContestOrganization(contest.id),
    readColleagues(contest.id),
  ])
  return {
    access,
    contest,
    isOpen,
    players,
    deletedCount,
    colleagues: organization && colleagues,
  }
}

const ContestPage = ({ loaderData }: Route.ComponentProps) =>
  loaderData.access === `shared` ? (
    <SharedContestDetails {...loaderData} />
  ) : (
    <ContestDetails {...loaderData} />
  )
export default ContestPage
