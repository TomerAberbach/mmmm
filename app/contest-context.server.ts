import { createContext, data } from 'react-router'
import type { MiddlewareFunction, RouterContextProvider } from 'react-router'
import { readEducatorContest } from './contests.server.ts'
import type { Contest } from './contests.server.ts'
import { readRequiredEducator } from './session.server.ts'
import { readSharedContest } from './shares.server.ts'
import type { SharedContest } from './shares.server.ts'

/** A colleague has no contest link and changes nothing */
export type ViewableContest =
  | { access: `own`; contest: Contest }
  | { access: `shared`; contest: SharedContest }

const contestContext = createContext<ViewableContest | null>()

/**
 * Loads the contest in the address. Nest it after `requireSignedInEducator`, and
 * read the contest with `readRequiredContest` or `readViewableContest`
 */
export const loadEducatorContest: MiddlewareFunction<Response> = async (
  { params: { contestId = `` }, context },
  next,
) => {
  context.set(
    contestContext,
    await findContest(readRequiredEducator(context).id, contestId),
  )
  return next()
}

const findContest = async (
  educatorId: string,
  contestId: string,
): Promise<ViewableContest | null> => {
  const owned = await readEducatorContest(educatorId, contestId)
  if (owned) {
    return { access: `own`, contest: owned }
  }
  const shared = await readSharedContest(educatorId, contestId)
  return shared && { access: `shared`, contest: shared }
}

/**
 * The contest the educator runs or that's shared with them. Throws the not-found
 * page for another, so its ID reveals nothing. Call it in a loader, because a
 * throw in middleware skips root's loader, so the header would lack the educator
 */
export const readViewableContest = (
  context: Readonly<RouterContextProvider>,
): ViewableContest => {
  const viewable = context.get(contestContext)
  if (!viewable) {
    // React Router renders a thrown response with the error page
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw data(null, { status: 404 })
  }
  return viewable
}

/** Like `readViewableContest`, for only a contest the educator runs */
export const readRequiredContest = (
  context: Readonly<RouterContextProvider>,
): Contest => {
  const viewable = readViewableContest(context)
  if (viewable.access !== `own`) {
    // React Router renders a thrown response with the error page
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw data(null, { status: 404 })
  }
  return viewable.contest
}
