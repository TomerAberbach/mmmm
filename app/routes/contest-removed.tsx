import type { Route } from './+types/contest-removed.ts'
import { RemovedContest } from '~/components/removed.tsx'
import { readRemovedContext } from '~/removed-paths.ts'

export const loader = ({ request }: Route.LoaderArgs) =>
  readRemovedContext(request)

const ContestRemovedPage = ({ loaderData }: Route.ComponentProps) => (
  <RemovedContest isOrphaned={loaderData.isOrphaned} />
)
export default ContestRemovedPage
