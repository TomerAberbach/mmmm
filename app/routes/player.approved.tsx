import { Outlet } from 'react-router'
import type { Route } from './+types/player.approved.ts'
import { requireApprovedPlayer } from '~/play-context.server.ts'

/** Pages below are only for a player whose submission is approved */
export const middleware: Route.MiddlewareFunction[] = [requireApprovedPlayer]

/** Middleware runs on client-side navigations only for routes with a loader */
export const loader = () => null

const ApprovedPlayerRoute = () => <Outlet />
export default ApprovedPlayerRoute
