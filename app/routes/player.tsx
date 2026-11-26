import type { Route } from './+types/player.ts'
import { PlayLayout } from '~/components/play-contest.tsx'
import { loadContestById, readPlayContest } from '~/play-context.server.ts'

export const middleware: Route.MiddlewareFunction[] = [loadContestById]

export const loader = ({ context }: Route.LoaderArgs) =>
  readPlayContest(context)

const PlayerRoute = ({ loaderData }: Route.ComponentProps) => (
  <PlayLayout contest={loaderData} />
)
export default PlayerRoute
