import { data, href, redirect } from 'react-router'
import type { Route } from './+types/my-bracket.ts'
import { isCurrentYear } from '~/brackets.server.ts'
import { BrokenLink, DeletedBracket } from '~/components/removed.tsx'
import { rememberPlayer } from '~/player-cookie.server.ts'
import { readPersonalLink } from '~/players.server.ts'
import { readEraseTime } from '~/trash.ts'

/**
 * A personal link moves its secret into the player's cookie and redirects, so
 * the secret appears in only this one request
 */
export const loader = async ({ params }: Route.LoaderArgs) => {
  const target = await readPersonalLink(params.secret)
  if (!target) {
    return data(null, { status: 404 })
  }
  if (target.state === `contestDeleted`) {
    throw redirect(href(`/contest-removed`))
  }
  const contestLink = { linkSecret: target.contestLinkSecret }
  if (target.state === `deleted`) {
    const canStart = await isCurrentYear(target.year)
    return data(
      {
        restoreBy: readEraseTime(target),
        contestPath: canStart ? href(`/play/:linkSecret`, contestLink) : null,
      },
      // Browsers cache a 410 forever, and the educator may restore the player
      { status: 404 },
    )
  }
  throw redirect(href(`/play/:linkSecret/bracket`, contestLink), {
    headers: {
      'Set-Cookie': await rememberPlayer(target.contestId, params.secret),
    },
  })
}

const PersonalLinkPage = ({ loaderData }: Route.ComponentProps) => (
  <>
    <meta name='robots' content='noindex' />
    {loaderData ? <DeletedBracket {...loaderData} /> : <BrokenLink />}
  </>
)
export default PersonalLinkPage
