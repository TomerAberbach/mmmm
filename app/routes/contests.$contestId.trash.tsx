import type { Route } from './+types/contests.$contestId.trash.ts'
import { ContestTrash } from '~/components/contest-trash.tsx'
import { readRequiredContest } from '~/contest-context.server.ts'
import { readDeletedPlayers } from '~/trash.server.ts'

export const loader = async ({ context }: Route.LoaderArgs) => {
  const contest = readRequiredContest(context)
  return { contest, players: await readDeletedPlayers(contest.id) }
}

const ContestTrashPage = ({ loaderData }: Route.ComponentProps) => (
  <ContestTrash contest={loaderData.contest} players={loaderData.players} />
)
export default ContestTrashPage
