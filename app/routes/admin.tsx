import { Outlet } from 'react-router'
import type { Route } from './+types/admin.ts'
import { requireAdmin, requireSignedInEducator } from '~/session.server.ts'

export const middleware: Route.MiddlewareFunction[] = [
  requireSignedInEducator,
  requireAdmin,
]

const AdminLayout = () => <Outlet />
export default AdminLayout
