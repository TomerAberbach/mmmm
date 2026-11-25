import type { Route } from './+types/player.ts'
import { PlayLayout } from '~/components/play-contest.tsx'
import { loadContestById, readPlayContest } from '~/play-context.server.ts'

export const middleware: Route.MiddlewareFunction[] = [loadContestById]

export const loader = ({ context }: Route.LoaderArgs) => {
  const { id: _, ...contest } = readPlayContest(context)
  return contest
}

const PlayerRoute = ({ loaderData }: Route.ComponentProps) => (
  <PlayLayout contest={loaderData} />
)
export default PlayerRoute
