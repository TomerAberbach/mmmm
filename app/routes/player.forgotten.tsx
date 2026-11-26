import { href, redirect } from 'react-router'
import type { Route } from './+types/player.forgotten.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { readPlayContest } from '~/play-context.server.ts'
import { forgetPlayer } from '~/player-cookie.server.ts'

/**
 * Forgets the player this browser remembers in the contest, for shared
 * computers
 */
export const action = async ({ params, context }: Route.ActionArgs) => {
  throw redirect(href(`/player/:contestId/forgotten`, params), {
    headers: { 'Set-Cookie': await forgetPlayer(readPlayContest(context).id) },
  })
}

const ForgottenPage = () => (
  <div className='flex max-w-xl flex-col gap-3'>
    <PageTitle>This computer forgot your bracket</PageTitle>
    <p>
      Open your personal link to come back to your bracket. If you don’t have
      one, open the contest link your educator shared to start a new bracket.
    </p>
  </div>
)
export default ForgottenPage
