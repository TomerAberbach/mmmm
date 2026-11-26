import { data, href, redirect } from 'react-router'
import type { Route } from './+types/player.forgotten.ts'
import { PageTitle } from '~/components/page-title.tsx'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { OTHER_PLAYER_STATUS } from '~/other-player.ts'
import { readPlayContest } from '~/play-context.server.ts'
import { forgetPlayer, readRememberedPlayer } from '~/player-cookie.server.ts'

/**
 * Forgets the player this browser remembers in the contest, for shared
 * computers, unless the page showed another player. The next player may have
 * started since, and a draft has no personal link to come back with
 */
export const action = async ({
  request,
  params,
  context,
}: Route.ActionArgs): Promise<ReturnType<typeof refuse>> => {
  const contest = readPlayContest(context)
  const playerId = (await request.formData()).get(`playerId`)
  const player = await readRememberedPlayer(request, contest.id)
  if (player && playerId === null) {
    return refuse(`This device wasn’t forgotten. Reload the page and try again`)
  }
  if (player && player.id !== playerId) {
    return refuse(
      `This device already forgot your bracket, and opens another player’s now`,
    )
  }
  throw redirect(href(`/player/:contestId/forgotten`, params), {
    headers: { 'Set-Cookie': await forgetPlayer(contest.id) },
  })
}

/** The status keeps the page from reloading, which would show the other player */
const refuse = (error: string) =>
  data<ConfirmResult>({ error }, { status: OTHER_PLAYER_STATUS })

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
