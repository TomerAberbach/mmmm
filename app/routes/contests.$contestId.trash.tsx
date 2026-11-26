import type { Route } from './+types/contests.$contestId.trash.ts'
import { ContestTrash } from '~/components/contest-trash.tsx'
import { readRequiredContest } from '~/contest-context.server.ts'
import { readDeletedPlayers } from '~/trash.server.ts'
import { isOpenYear } from '~/years.server.ts'

export const loader = async ({ context }: Route.LoaderArgs) => {
  const contest = readRequiredContest(context)
  const [players, isOpen] = await Promise.all([
    readDeletedPlayers(contest.id),
    isOpenYear(contest.year),
  ])
  return { contest, players, isOpen }
}

const ContestTrashPage = ({ loaderData }: Route.ComponentProps) => (
  <ContestTrash {...loaderData} />
)
export default ContestTrashPage
