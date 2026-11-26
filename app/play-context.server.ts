import { createContext, href, redirect } from 'react-router'
import type {
  MiddlewareFunction,
  Params,
  RouterContextProvider,
} from 'react-router'
import { brokenLink } from './broken-link.ts'
import { readContestById, readContestByLink } from './contests.server.ts'
import type { PlayContest } from './contests.server.ts'
import type { LeaderboardViewer } from './leaderboards.server.ts'
import { readRememberedPlayer, rememberPlayer } from './player-cookie.server.ts'
import { readSubmissionStatus } from './player-picks.server.ts'
import { isOpenYear } from './years.server.ts'

const contestContext = createContext<PlayContest>()

/**
 * Answers a contest `read` doesn't find with the broken link page, and a deleted
 * one with a page that says so. Routes below it read the contest with
 * `readPlayContest`
 */
const loadContest =
  (
    read: (params: Params) => ReturnType<typeof readContestById>,
  ): MiddlewareFunction<Response> =>
  async ({ params, context }, next) => {
    const found = await read(params)
    if (!found) {
      // React Router renders a thrown response with the error page
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw brokenLink()
    }
    if (found.isDeleted) {
      return redirect(href(`/contest-removed`))
    }
    context.set(contestContext, found.contest)
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

/**
 * Sends a player whose submission isn't approved, or whose year isn't locked,
 * back to their bracket, since leaderboards are only for approved players and
 * start at the lock. Nest it after `requirePlayer`
 */
export const requireApprovedPlayer: MiddlewareFunction<Response> = async (
  { context },
  next,
) => {
  const { id: contestId, year } = readPlayContest(context)
  const [status, isOpen] = await Promise.all([
    readSubmissionStatus(readRequiredPlayer(context).id),
    isOpenYear(year),
  ])
  return status === `APPROVED` && !isOpen
    ? next()
    : redirect(href(`/player/:contestId/bracket`, { contestId }))
}

/** The remembered player, as a leaderboard's viewer */
export const readPlayerViewer = (
  context: Readonly<RouterContextProvider>,
): LeaderboardViewer => ({
  kind: `player`,
  contestId: readPlayContest(context).id,
  playerId: readRequiredPlayer(context).id,
})

export const readRequiredPlayer = (
  context: Readonly<RouterContextProvider>,
): RequiredPlayer => context.get(playerContext)
