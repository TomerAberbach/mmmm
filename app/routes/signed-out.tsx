import { Outlet } from 'react-router'
import type { Route } from './+types/signed-out.ts'
import { requireSignedOut } from '~/session.server.ts'

// Also refuses a signed-in educator's form posts
export const middleware: Route.MiddlewareFunction[] = [requireSignedOut]

// A client-side navigation runs server middleware only when it calls a loader,
// so each navigation to or between these routes calls this one
export const loader = (): null => null

export const shouldRevalidate = (): boolean => true

const SignedOutLayout = () => <Outlet />
export default SignedOutLayout
