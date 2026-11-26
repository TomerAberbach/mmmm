import { Outlet } from 'react-router'
import type { Route } from './+types/player.remembered.ts'
import { requirePlayer } from '~/play-context.server.ts'

/** Pages below are only for the player this browser remembers */
export const middleware: Route.MiddlewareFunction[] = [requirePlayer]

/** Middleware runs on client-side navigations only for routes with a loader */
export const loader = () => null

const RememberedPlayerRoute = () => <Outlet />
export default RememberedPlayerRoute
