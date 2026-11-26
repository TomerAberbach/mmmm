import { href, redirect } from 'react-router'
import type { Route } from './+types/settings.remove-passkey.ts'
import { readRefusal } from '~/app-refusal.server.ts'
import { auth } from '~/auth.server.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/settings`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const id = (await request.formData()).get(`id`)
  if (typeof id !== `string`) {
    return { error: `That passkey wasn’t found. Reload the page` }
  }
  try {
    await auth.api.deletePasskey({ body: { id }, headers: request.headers })
  } catch (error) {
    const message = readRefusal(error)
    if (message !== undefined) {
      return { error: message }
    }
    console.error(`Failed to remove a passkey`, error)
    return { error: `The passkey wasn’t removed. Try again` }
  }
  return { ok: true }
}
