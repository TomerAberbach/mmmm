import { href, redirect } from 'react-router'
import type { Route } from './+types/settings.sign-out-others.ts'
import { auth } from '~/auth.server.ts'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'

export const loader = (): Response => redirect(href(`/settings`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  try {
    await auth.api.revokeOtherSessions({ headers: request.headers })
  } catch (error) {
    console.error(`Failed to sign out other sessions`, error)
    return { error: `Your other sessions weren't signed out. Try again.` }
  }
  return { ok: true }
}
