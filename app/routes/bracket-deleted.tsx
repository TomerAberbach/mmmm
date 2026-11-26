import type { Route } from './+types/bracket-deleted.ts'
import { DeletedOwnBracket } from '~/components/removed.tsx'
import { readRemovedContext } from '~/removed-paths.ts'

export const loader = ({ request }: Route.LoaderArgs) =>
  readRemovedContext(request)

const BracketDeletedPage = ({ loaderData }: Route.ComponentProps) => (
  <DeletedOwnBracket contestPath={null} {...loaderData} />
)
export default BracketDeletedPage
