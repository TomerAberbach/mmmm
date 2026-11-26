import type { Route } from './+types/play.ts'
import { PlayLayout } from '~/components/play-contest.tsx'
import { loadContestByLink, readPlayContest } from '~/play-context.server.ts'

export const middleware: Route.MiddlewareFunction[] = [loadContestByLink]

export const loader = ({ context }: Route.LoaderArgs) => {
  const { id: _, ...contest } = readPlayContest(context)
  return contest
}

const PlayRoute = ({ loaderData }: Route.ComponentProps) => (
  <PlayLayout contest={loaderData} />
)
export default PlayRoute
