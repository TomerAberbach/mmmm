import { href, redirect } from 'react-router'
import type { Route } from './+types/settings.remove-passkey.ts'
import { readRefusal } from '~/app-refusal.server.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { removePasskey } from '~/second-factor.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

const NOT_FOUND_MESSAGE = `That passkey wasn’t found. Reload the page`

export const loader = (): Response => redirect(href(`/settings`))

export const action = async ({
  request,
  context,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const id = (await request.formData()).get(`id`)
  if (typeof id !== `string`) {
    return { error: NOT_FOUND_MESSAGE }
  }
  try {
    const isRemoved = await removePasskey(
      id,
      readRequiredEducator(context).id,
      readRequiredSession(context).assurance,
    )
    return isRemoved ? { ok: true } : { error: NOT_FOUND_MESSAGE }
  } catch (error) {
    const message = readRefusal(error)
    if (message !== undefined) {
      return { error: message }
    }
    console.error(`Failed to remove a passkey`, error)
    return { error: `The passkey wasn’t removed. Try again` }
  }
}
