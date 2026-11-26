import { href } from 'react-router'
import type { Route } from './+types/player.ts'
import { PastYearBanner } from '~/components/past-year-banner.tsx'
import { PlayLayout } from '~/components/play-contest.tsx'
import { readPastYear } from '~/past-years.server.ts'
import { loadContestById, readPlayContest } from '~/play-context.server.ts'

export const middleware: Route.MiddlewareFunction[] = [loadContestById]

export const loader = async ({ context }: Route.LoaderArgs) => {
  const contest = readPlayContest(context)
  return { contest, pastYear: await readPastYear(contest.year) }
}

const PlayerRoute = ({
  loaderData: { contest, pastYear },
}: Route.ComponentProps) => (
  <div className='flex flex-col gap-6'>
    <PastYearBanner pastYear={pastYear} currentPath={href(`/bracket`)} />
    <PlayLayout contest={contest} />
  </div>
)
export default PlayerRoute
