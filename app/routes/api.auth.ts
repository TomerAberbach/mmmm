import type { Route } from './+types/api.auth.ts'
import { answerAuthRequest } from '~/auth-endpoints.server.ts'

const handleAuth = ({
  request,
}: Route.LoaderArgs | Route.ActionArgs): Promise<Response> =>
  answerAuthRequest(request)

export { handleAuth as loader, handleAuth as action }
