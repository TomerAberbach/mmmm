import { href, redirect } from 'react-router'
import type { Route } from './+types/sign-out.ts'
import { auth } from '~/auth.server.ts'

export const loader = (): Response => redirect(href(`/`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<Response> => {
  const { headers } = await auth.api.signOut({
    headers: request.headers,
    returnHeaders: true,
  })
  return redirect(href(`/`), { headers })
}
