import { href } from 'react-router'
import type { Route } from './+types/play.deleted.ts'
import { DeletedOwnBracket } from '~/components/removed.tsx'
import { readPastYear } from '~/past-years.server.ts'
import { readPlayContest } from '~/play-context.server.ts'

export const loader = async ({ context }: Route.LoaderArgs) => {
  const { year, educatorName } = readPlayContest(context)
  return {
    isOrphaned: educatorName === null,
    isPast: (await readPastYear(year)) !== null,
  }
}

const DeletedPage = ({ loaderData, params }: Route.ComponentProps) => (
  <DeletedOwnBracket
    contestPath={href(`/play/:linkSecret`, params)}
    isPast={loaderData.isPast}
    isOrphaned={loaderData.isOrphaned}
  />
)
export default DeletedPage
