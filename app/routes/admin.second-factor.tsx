import { Outlet, redirect } from 'react-router'
import type { Route } from './+types/admin.second-factor.ts'
import {
  readSecondFactors,
  readSecondFactorStep,
} from '~/second-factor.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

const requireSecondFactor: Route.MiddlewareFunction = async (
  { context },
  next,
) =>
  readRequiredSession(context).assurance === `SECOND_FACTOR`
    ? next()
    : redirect(
        readSecondFactorStep(
          await readSecondFactors(readRequiredEducator(context).id),
        ),
      )

export const middleware: Route.MiddlewareFunction[] = [requireSecondFactor]

const SecondFactorLayout = () => <Outlet />
export default SecondFactorLayout
