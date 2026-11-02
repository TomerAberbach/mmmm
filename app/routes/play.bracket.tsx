import type { Route } from './+types/play.bracket.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { readRequiredPlayer, requirePlayer } from '~/play-context.server.ts'

export const middleware: Route.MiddlewareFunction[] = [requirePlayer]

export const loader = ({ context }: Route.LoaderArgs) =>
  readRequiredPlayer(context)

const PlayerBracketPage = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-3'>
    <PageTitle>{`${loaderData.displayName}’s bracket`}</PageTitle>
    <p>Your bracket is saved. Picking winners opens here soon.</p>
  </div>
)
export default PlayerBracketPage
