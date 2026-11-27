import { href, redirect } from 'react-router'
import type { Route } from './+types/settings.sign-out-others.ts'
import { auth } from '~/auth.server.ts'
import type { ConfirmReply } from '~/form-replies.server.ts'
import { refuseChange } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/settings`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<ConfirmReply> => {
  try {
    await auth.api.revokeOtherSessions({ headers: request.headers })
  } catch (error) {
    console.error(`Failed to sign out other sessions`, error)
    return refuseChange(`Your other sessions weren’t signed out. Try again`)
  }
  return { ok: true }
}
