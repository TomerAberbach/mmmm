import { createContext, data, redirect } from 'react-router'
import type { MiddlewareFunction, RouterContextProvider } from 'react-router'
import { readContestByLink } from './contests.server.ts'
import type { ContestByLink } from './contests.server.ts'
import { toContestPath } from './paths.ts'
import { readRememberedPlayer, rememberPlayer } from './player-cookie.server.ts'

const contestContext = createContext<ContestByLink>()

// Answers a link that matches no contest with the not-found page. Routes below
// it read the contest with `readPlayContest`
export const loadPlayContest: MiddlewareFunction<Response> = async (
  { params, context },
  next,
) => {
  const contest = await readContestByLink(params.linkSecret ?? ``)
  if (!contest) {
    // React Router renders a thrown response with the error page
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw data(null, { status: 404 })
  }
  context.set(contestContext, contest)
  return next()
}

export const readPlayContest = (
  context: Readonly<RouterContextProvider>,
): ContestByLink => context.get(contestContext)

export type RequiredPlayer = { id: string; displayName: string }

const playerContext = createContext<RequiredPlayer>()

// Sends anyone the browser doesn't remember to the contest link. Each response
// restarts the remembered player's 15 minutes. Nest it after
// `loadPlayContest`, and read the player with `readRequiredPlayer`
export const requirePlayer: MiddlewareFunction<Response> = async (
  { request, params, context },
  next,
) => {
  const contest = readPlayContest(context)
  const player = await readRememberedPlayer(request, contest.id)
  if (!player) {
    return redirect(toContestPath(params.linkSecret ?? ``))
  }
  context.set(playerContext, { id: player.id, displayName: player.displayName })
  const response = await next()
  response.headers.append(
    `Set-Cookie`,
    await rememberPlayer(contest.id, player.secret),
  )
  return response
}

export const readRequiredPlayer = (
  context: Readonly<RouterContextProvider>,
): RequiredPlayer => context.get(playerContext)
