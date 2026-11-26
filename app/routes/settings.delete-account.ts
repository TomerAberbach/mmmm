import { href, redirect } from 'react-router'
import type { Route } from './+types/settings.delete-account.ts'
import { answerAccountDeletion } from '~/account-deletion-replies.server.ts'
import { auth } from '~/auth.server.ts'
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
      : `Sign in with your second factor first`,
    onDeleted: async () => {
      // The session went with the account, so this only clears its cookies
      const { headers } = await auth.api.signOut({
        headers: request.headers,
        returnHeaders: true,
      })
      return redirect(href(`/account-deleted`), { headers })
    },
  })
}
