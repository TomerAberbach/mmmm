import { data, href, redirect } from 'react-router'
import type { Route } from './+types/play.deleted.ts'
import { isCurrentYear } from '~/brackets.server.ts'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { DeletedOwnBracket } from '~/components/removed.tsx'
import { readPlayContest } from '~/play-context.server.ts'
import { forgetPlayer, readRememberedPlayer } from '~/player-cookie.server.ts'
import { deleteOwnPlayer } from '~/trash.server.ts'

export const loader = async ({ context }: Route.LoaderArgs) => ({
  canStart: await isCurrentYear(readPlayContest(context).year),
})

/**
 * Deletes the player this browser remembers in the contest, and forgets them,
 * unless the page showed another player. On a shared computer, the next player
 * may have started since
 */
export const action = async ({
  request,
  params,
  context,
}: Route.ActionArgs): Promise<Response | ReturnType<typeof refuse>> => {
  const contest = readPlayContest(context)
  const formData = await request.formData()
  const player = await readRememberedPlayer(request, contest.id)
  if (
    player?.id !== formData.get(`playerId`) ||
    !(await deleteOwnPlayer(player.id))
  ) {
    return refuse()
  }
  return redirect(href(`/play/:linkSecret/deleted`, params), {
    headers: { 'Set-Cookie': await forgetPlayer(contest.id) },
  })
}

const refuse = () =>
  data<ConfirmResult>({
    error: `Your bracket wasn’t deleted. Open your personal link and try again`,
  })

const DeletedPage = ({ loaderData, params }: Route.ComponentProps) => (
  <DeletedOwnBracket
    contestPath={loaderData.canStart ? href(`/play/:linkSecret`, params) : null}
  />
)
export default DeletedPage
