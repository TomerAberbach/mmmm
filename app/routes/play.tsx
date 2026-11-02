import { Outlet } from 'react-router'
import type { Route } from './+types/play.ts'
import { ContestContext } from '~/components/play-contest.tsx'
import { loadPlayContest, readPlayContest } from '~/play-context.server.ts'

export const middleware: Route.MiddlewareFunction[] = [loadPlayContest]

export const loader = ({ context }: Route.LoaderArgs) => {
  const { id: _, ...contest } = readPlayContest(context)
  return contest
}

const PlayLayout = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex max-w-xl flex-col gap-6'>
    {/* Search engines skip these pages, since their URLs hold the contest
        link's secret */}
    <meta name='robots' content='noindex' />
    <ContestContext contest={loaderData} />
    <Outlet />
  </div>
)
export default PlayLayout
