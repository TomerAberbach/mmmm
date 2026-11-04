import { redirect } from 'react-router'
import type { Route } from './+types/play.forgotten.ts'
import { PageTitle } from '~/components/page-title.tsx'
import { toForgottenPath } from '~/paths.ts'
import { readPlayContest } from '~/play-context.server.ts'
import { forgetPlayer } from '~/player-cookie.server.ts'

// Forgets the player this browser remembers in the contest, for shared
// computers
export const action = async ({ params, context }: Route.ActionArgs) => {
  throw redirect(toForgottenPath(params.linkSecret), {
    headers: { 'Set-Cookie': await forgetPlayer(readPlayContest(context).id) },
  })
}

const ForgottenPage = () => (
  <div className='flex max-w-xl flex-col gap-3'>
    <PageTitle>This computer forgot your bracket</PageTitle>
    <p>
      Your bracket is still saved. Open your personal link to come back to it.
    </p>
  </div>
)
export default ForgottenPage
