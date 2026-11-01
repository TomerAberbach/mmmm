import { Outlet } from 'react-router'
import type { Route } from './+types/contests.ts'
import { requireSignedInEducator } from '~/session.server.ts'

export const middleware: Route.MiddlewareFunction[] = [requireSignedInEducator]

const ContestsLayout = () => <Outlet />
export default ContestsLayout
