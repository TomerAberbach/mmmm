import { data, href, redirect } from 'react-router'
import type { Route } from './+types/player.delete.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { OTHER_PLAYER_STATUS } from '~/other-player.ts'
import { readPlayContest } from '~/play-context.server.ts'
import { forgetPlayer, readRememberedPlayer } from '~/player-cookie.server.ts'
import { readPersonalLink } from '~/players.server.ts'
import { deleteOwnPlayer } from '~/trash.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/player/:contestId/bracket`, params))

/**
 * Deletes the player this browser remembers in the contest, and forgets them,
 * unless the page showed another player. On a shared computer, the next player
 * may have started since
 */
export const action = async ({
  request,
  context,
}: Route.ActionArgs): Promise<Response | ReturnType<typeof refuse>> => {
  const contest = readPlayContest(context)
  const formData = await request.formData()
  if (!formData.has(`playerId`)) {
    return data<ConfirmResult>(
      { error: `Your bracket wasn’t deleted. Reload the page and try again` },
      { status: 400 },
    )
  }
  const player = await readRememberedPlayer(request, contest.id)
  if (
    player?.id !== formData.get(`playerId`) ||
    !(await deleteOwnPlayer(player.id))
  ) {
    return refuse()
  }
  return redirect(await readDeletedPath(player.secret), {
    headers: { 'Set-Cookie': await forgetPlayer(contest.id) },
  })
}

/** The status keeps the page from reloading, which would show the other player */
const refuse = () =>
  data<ConfirmResult>(
    {
      error: `Your bracket wasn’t deleted. Open your personal link and try again`,
    },
    { status: OTHER_PLAYER_STATUS },
  )

/** The page that says so, with a button to start again when the player can */
const readDeletedPath = async (secret: string): Promise<string> => {
  const target = await readPersonalLink(secret)
  const linkSecret = target?.state === `deleted` ? target.startLinkSecret : null
  return linkSecret === null
    ? href(`/bracket-deleted`)
    : href(`/play/:linkSecret/deleted`, { linkSecret })
}
