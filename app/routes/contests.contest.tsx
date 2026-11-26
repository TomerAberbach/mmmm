import type { Route } from './+types/contests.contest.ts'
import { YearLayout } from '~/components/past-year-banner.tsx'
import {
  loadEducatorContest,
  readViewableContest,
} from '~/contest-context.server.ts'
import { readPastYear } from '~/past-years.server.ts'

export const middleware: Route.MiddlewareFunction[] = [loadEducatorContest]

/**
 * Pages below are only for the educator who runs the contest and the colleagues
 * it's shared with
 */
export const loader = ({ context }: Route.LoaderArgs) =>
  readPastYear(readViewableContest(context).contest.year)

const ContestLayout = ({ loaderData }: Route.ComponentProps) => (
  <YearLayout pastYear={loaderData} />
)
export default ContestLayout
