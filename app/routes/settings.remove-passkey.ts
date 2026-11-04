import { APIError } from 'better-auth/api'
import { href, redirect } from 'react-router'
import type { Route } from './+types/settings.remove-passkey.ts'
import { auth } from '~/auth.server.ts'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { isSecondFactorRefusal } from '~/second-factor.ts'

export const loader = (): Response => redirect(href(`/settings`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const id = (await request.formData()).get(`id`)
  if (typeof id !== `string`) {
    return { error: `That passkey wasn't found. Reload the page.` }
  }
  try {
    await auth.api.deletePasskey({ body: { id }, headers: request.headers })
  } catch (error) {
    if (error instanceof APIError && isSecondFactorRefusal(error.body?.code)) {
      return { error: error.body?.message ?? error.message }
    }
    console.error(`Failed to remove a passkey`, error)
    return { error: `The passkey wasn't removed. Try again.` }
  }
  return { ok: true }
}
