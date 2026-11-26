import type { Route } from './+types/contests.year.ts'
import { YearLayout } from '~/components/past-year-banner.tsx'
import { readPastYear, readRequiredYear } from '~/past-years.server.ts'

export const loader = async ({ params }: Route.LoaderArgs) =>
  readPastYear(await readRequiredYear(params.year))

const YearRoute = ({ loaderData }: Route.ComponentProps) => (
  <YearLayout pastYear={loaderData} />
)
export default YearRoute
