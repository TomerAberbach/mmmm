import { href, Outlet, redirect } from 'react-router'
import type { Route } from './+types/admin.second-factor.ts'
import { hasSecondFactor, readSecondFactors } from '~/second-factor.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

/** Sends an admin without a second factor to set one up, or to use theirs */
const requireSecondFactor: Route.MiddlewareFunction = async (
  { context },
  next,
) => {
  if (readRequiredSession(context).assurance === `SECOND_FACTOR`) {
    return next()
  }
  const secondFactors = await readSecondFactors(
    readRequiredEducator(context).id,
  )
  return redirect(
    href(hasSecondFactor(secondFactors) ? `/admin/verify` : `/admin/setup`),
  )
}

export const middleware: Route.MiddlewareFunction[] = [requireSecondFactor]

const SecondFactorLayout = () => <Outlet />
export default SecondFactorLayout
