import type { Route } from './+types/api.auth.ts'
import { auth } from '~/auth.server.ts'

const handleAuth = ({
  request,
}: Route.LoaderArgs | Route.ActionArgs): Promise<Response> =>
  auth.handler(request)

export { handleAuth as loader, handleAuth as action }
