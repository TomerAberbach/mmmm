import type { Route } from './+types/play.ts'
import { PlayLayout } from '~/components/play-contest.tsx'
import { loadContestByLink, readPlayContest } from '~/play-context.server.ts'

export const middleware: Route.MiddlewareFunction[] = [loadContestByLink]

export const loader = ({ context }: Route.LoaderArgs) =>
  readPlayContest(context)

const PlayRoute = ({ loaderData }: Route.ComponentProps) => (
  <PlayLayout contest={loaderData} />
)
export default PlayRoute
