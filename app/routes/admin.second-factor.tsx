import { href, Outlet, redirect } from 'react-router'
import type { Route } from './+types/admin.second-factor.ts'
import { hasSecondFactor, readSecondFactors } from '~/second-factor.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

/** Sends an admin without a second factor to set one up, or to use theirs */
const requireSecondFactor: Route.MiddlewareFunction = async (
  { context },
  next,
) => {
  // A session can outlast its educator's second factors
  const secondFactors = await readSecondFactors(
    readRequiredEducator(context).id,
  )
  if (!hasSecondFactor(secondFactors)) {
    return redirect(href(`/admin/setup`))
  }
  return readRequiredSession(context).assurance === `SECOND_FACTOR`
    ? next()
    : redirect(href(`/admin/verify`))
}

export const middleware: Route.MiddlewareFunction[] = [requireSecondFactor]

const SecondFactorLayout = () => <Outlet />
export default SecondFactorLayout
