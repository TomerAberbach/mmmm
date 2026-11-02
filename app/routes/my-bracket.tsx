import { data, redirect } from 'react-router'
import type { Route } from './+types/my-bracket.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { toBracketPath } from '~/paths.ts'
import { rememberPlayer } from '~/player-cookie.server.ts'
import { readPlayerByLink } from '~/players.server.ts'

// A personal link moves its secret into the player's cookie and redirects, so
// the secret appears in only this one request
export const loader = async ({ params }: Route.LoaderArgs) => {
  const player = await readPlayerByLink(params.secret)
  if (!player) {
    return data(null, { status: 404 })
  }
  throw redirect(toBracketPath(player.contestLinkSecret), {
    headers: {
      'Set-Cookie': await rememberPlayer(player.contestId, params.secret),
    },
  })
}

const BrokenLinkPage = () => (
  <div className='flex max-w-xl flex-col gap-3'>
    <meta name='robots' content='noindex' />
    <PageTitle>This link doesn’t work</PageTitle>
    <p>Ask your educator for a new one.</p>
  </div>
)
export default BrokenLinkPage
