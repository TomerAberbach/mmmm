import { redirect } from 'react-router'
import type { Route } from './+types/sign-out.ts'
import { auth } from '~/auth.server.ts'

export const loader = (): Response => redirect(`/`)

export const action = async ({
  request,
}: Route.ActionArgs): Promise<Response> => {
  const { headers } = await auth.api.signOut({
    headers: request.headers,
    returnHeaders: true,
  })
  return redirect(`/`, { headers })
}
