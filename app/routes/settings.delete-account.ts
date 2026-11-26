import { href, redirect } from 'react-router'
import type { Route } from './+types/settings.delete-account.ts'
import {
  answerAccountDeletion,
  leaveDeletedAccount,
} from '~/account-deletion-replies.server.ts'
import type { FormRejection } from '~/form-replies.server.ts'
import { mayDeleteAccount, readSecondFactors } from '~/second-factor.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

export const loader = (): Response => redirect(href(`/settings`))

export const action = async ({
  request,
  context,
}: Route.ActionArgs): Promise<Response | FormRejection> => {
  const { id } = readRequiredEducator(context)
  const { assurance } = readRequiredSession(context)
  return answerAccountDeletion(request, id, {
    refusal: mayDeleteAccount(assurance, await readSecondFactors(id))
      ? null
      : `Use your second factor first. Reload the page to see how`,
    onDeleted: () => leaveDeletedAccount(request),
  })
}
