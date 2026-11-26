import { createContext, data } from 'react-router'
import type { MiddlewareFunction, RouterContextProvider } from 'react-router'
import { readEducatorContest } from './contests.server.ts'
import type { Contest } from './contests.server.ts'
import { readRequiredEducator } from './session.server.ts'

const contestContext = createContext<Contest | null>()

/**
 * Loads the contest in the address. Nest it after `requireSignedInEducator`, and
 * read the contest with `readRequiredContest`
 */
export const loadEducatorContest: MiddlewareFunction<Response> = async (
  { params: { contestId = `` }, context },
  next,
) => {
  context.set(
    contestContext,
    await readEducatorContest(readRequiredEducator(context).id, contestId),
  )
  return next()
}

/**
 * Throws the not-found page for another educator's contest, so its ID reveals
 * nothing. Call it in a loader, because a throw in middleware skips root's
 * loader, so the header would lack the educator
 */
export const readRequiredContest = (
  context: Readonly<RouterContextProvider>,
): Contest => {
  const contest = context.get(contestContext)
  if (!contest) {
    // React Router renders a thrown response with the error page
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw data(null, { status: 404 })
  }
  return contest
}
