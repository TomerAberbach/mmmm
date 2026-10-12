import { Outlet } from 'react-router'
import type { Route } from './+types/settings.ts'
import { requireSignedInEducator } from '~/session.server.ts'

export const middleware: Route.MiddlewareFunction[] = [requireSignedInEducator]

const SettingsLayout = () => <Outlet />
export default SettingsLayout
