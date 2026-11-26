import { createContext, href, redirect } from 'react-router'
import type {
  MiddlewareFunction,
  Params,
  RouterContextProvider,
} from 'react-router'
import { brokenLink } from './broken-link.ts'
import { readContestById, readContestByLink } from './contests.server.ts'
import type { ContestByLink } from './contests.server.ts'
import { readRememberedPlayer, rememberPlayer } from './player-cookie.server.ts'

/** A contest outside the trash, as its players see it */
export type PlayContest = Omit<ContestByLink, `isDeleted`>

const contestContext = createContext<PlayContest>()

/**
 * Answers a contest `read` doesn't find with the broken link page, and a deleted
 * one with a page that says so. Routes below it read the contest with
 * `readPlayContest`
 */
const loadContest =
  (
    read: (params: Params) => Promise<ContestByLink | null>,
  ): MiddlewareFunction<Response> =>
  async ({ params, context }, next) => {
    const contest = await read(params)
    if (!contest) {
      // React Router renders a thrown response with the error page
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw brokenLink()
    }
    const { isDeleted, ...playContest } = contest
    if (isDeleted) {
      return redirect(href(`/contest-removed`))
    }
    context.set(contestContext, playContest)
    return next()
  }

export const loadContestByLink = loadContest(({ linkSecret = `` }) =>
  readContestByLink(linkSecret),
)

/**
 * For a player's own pages, whose addresses leave out the contest link, so they
 * work after it's replaced and don't reveal the new one
 */
export const loadContestById = loadContest(({ contestId = `` }) =>
  readContestById(contestId),
)

export const readPlayContest = (
  context: Readonly<RouterContextProvider>,
): PlayContest => context.get(contestContext)

export type RequiredPlayer = {
  id: string
  displayName: string
  personalLinkSecret: string
}

const playerContext = createContext<RequiredPlayer>()

/**
 * Sends anyone the browser doesn't remember to a page that says how to come
 * back. Each response restarts the remembered player's 15 minutes. Nest it
 * after `loadContestById`, and read the player with `readRequiredPlayer`
 */
export const requirePlayer: MiddlewareFunction<Response> = async (
  { request, context },
  next,
) => {
  const contest = readPlayContest(context)
  const player = await readRememberedPlayer(request, contest.id)
  if (!player) {
    return redirect(
      href(`/player/:contestId/forgotten`, { contestId: contest.id }),
    )
  }
  context.set(playerContext, {
    id: player.id,
    displayName: player.displayName,
    personalLinkSecret: player.secret,
  })
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
