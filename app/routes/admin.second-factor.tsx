import { href, Link, Outlet, redirect, useMatch } from 'react-router'
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

/** Runs the middleware on client-side navigation to a page without a loader */
export const loader = () => null

/** Links each page but the first back to it */
const SecondFactorLayout = () =>
  useMatch(href(`/admin`)) ? (
    <Outlet />
  ) : (
    <div className='flex flex-col gap-6'>
      {/* Lines up with the page's title, even on a full-width page */}
      <div className='mx-auto w-full max-w-6xl print:hidden'>
        <Link to={href(`/admin`)}>Admin</Link>
      </div>
      <Outlet />
    </div>
  )
export default SecondFactorLayout
