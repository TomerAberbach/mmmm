import type { Route } from './+types/contests._index.ts'
import { readCurrentYear } from '~/brackets.server.ts'
import { EducatorDashboard } from '~/components/educator-dashboard.tsx'
import type { EducatorDashboardView } from '~/components/educator-dashboard.tsx'
import { readEducatorContests } from '~/contests.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { countDeletedContests } from '~/trash.server.ts'
import { readUpcomingYear } from '~/year.ts'

export const loader = async ({
  context,
}: Route.LoaderArgs): Promise<EducatorDashboardView> => {
  const year = await readCurrentYear()
  if (year === null) {
    return { current: null, upcomingYear: readUpcomingYear(new Date()) }
  }
  const educator = readRequiredEducator(context)
  const [contests, deletedCount] = await Promise.all([
    readEducatorContests(educator.id, year),
    countDeletedContests(educator.id, year),
  ])
  return {
    current: { year, contests, deletedCount },
  }
}

const EducatorDashboardPage = ({ loaderData }: Route.ComponentProps) => (
  <EducatorDashboard view={loaderData} />
)
export default EducatorDashboardPage
