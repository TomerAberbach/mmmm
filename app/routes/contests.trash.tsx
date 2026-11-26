import type { Route } from './+types/contests.trash.ts'
import { readCurrentYear } from '~/brackets.server.ts'
import { DeletedContests } from '~/components/deleted-contests.tsx'
import { readRequiredEducator } from '~/session.server.ts'
import { readDeletedContests } from '~/trash.server.ts'

export const loader = async ({ context }: Route.LoaderArgs) => {
  const current = await readCurrentYear()
  return {
    contests: current
      ? await readDeletedContests(
          readRequiredEducator(context).id,
          current.year,
        )
      : [],
  }
}

const DeletedContestsPage = ({ loaderData }: Route.ComponentProps) => (
  <DeletedContests contests={loaderData.contests} />
)
export default DeletedContestsPage
