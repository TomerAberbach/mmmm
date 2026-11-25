import { data } from 'react-router'
import type { Route } from './+types/contests.$contestId.trash.ts'
import { ContestTrash } from '~/components/contest-trash.tsx'
import { readEducatorContest } from '~/contests.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { readDeletedPlayers } from '~/trash.server.ts'

export const loader = async ({ context, params }: Route.LoaderArgs) => {
  const contest = await readEducatorContest(
    readRequiredEducator(context).id,
    params.contestId,
  )
  if (!contest) {
    throw data(null, { status: 404 })
  }
  return { contest, players: await readDeletedPlayers(contest.id) }
}

const ContestTrashPage = ({ loaderData }: Route.ComponentProps) => (
  <ContestTrash contest={loaderData.contest} players={loaderData.players} />
)
export default ContestTrashPage
