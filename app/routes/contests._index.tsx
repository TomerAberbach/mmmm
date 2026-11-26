import type { Route } from './+types/contests._index.ts'
import { readCurrentYear } from '~/brackets.server.ts'
import { EducatorDashboard } from '~/components/educator-dashboard.tsx'
import type { EducatorDashboardView } from '~/components/educator-dashboard.tsx'
import { readEducatorContests } from '~/contests.server.ts'
import { readOrganization } from '~/organizations.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { countDeletedContests } from '~/trash.server.ts'
import { readUpcomingYear } from '~/year.ts'

export const loader = async ({
  context,
}: Route.LoaderArgs): Promise<EducatorDashboardView> => {
  const educator = readRequiredEducator(context)
  const [current, organization] = await Promise.all([
    readCurrentYear(),
    readOrganization(educator.id),
  ])
  if (!current) {
    return {
      organization,
      current: null,
      upcomingYear: readUpcomingYear(new Date()),
    }
  }
  const { year, isLocked } = current
  const [contests, deletedCount] = await Promise.all([
    readEducatorContests(educator.id, year),
    countDeletedContests(educator.id, year),
  ])
  return {
    organization,
    current: { year, isLocked, contests, deletedCount },
  }
}

const EducatorDashboardPage = ({ loaderData }: Route.ComponentProps) => (
  <EducatorDashboard view={loaderData} />
)
export default EducatorDashboardPage
