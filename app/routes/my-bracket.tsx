import { data, href, redirect } from 'react-router'
import type { Route } from './+types/my-bracket.ts'
import { BrokenLink, DeletedBracket } from '~/components/removed.tsx'
import { rememberPlayer } from '~/player-cookie.server.ts'
import { readPersonalLink } from '~/players.server.ts'

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
  if (target.state === `deleted`) {
    const { startLinkSecret: linkSecret } = target
    return data(
      {
        restoreBy: target.restoreBy,
        contestPath:
          linkSecret === null
            ? null
            : href(`/play/:linkSecret`, { linkSecret }),
      },
      // Browsers cache a 410 forever, and the educator may restore the player
      { status: 404 },
    )
  }
  const { contestId } = target
  throw redirect(href(`/player/:contestId/bracket`, { contestId }), {
    headers: { 'Set-Cookie': await rememberPlayer(contestId, params.secret) },
  })
}

const PersonalLinkPage = ({ loaderData }: Route.ComponentProps) => (
  <>
    <meta name='robots' content='noindex' />
    {loaderData ? <DeletedBracket {...loaderData} /> : <BrokenLink />}
  </>
)
export default PersonalLinkPage
