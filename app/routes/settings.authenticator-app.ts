import { parseWithZod } from '@conform-to/zod/v4'
import { APIError } from 'better-auth/api'
import { data, href, redirect } from 'react-router'
import type { Route } from './+types/settings.authenticator-app.ts'
import { confirmPasswordSchema } from '~/auth-forms.ts'
import { rejectAuthError } from '~/auth-replies.server.ts'
import { auth } from '~/auth.server.ts'
import type { AuthenticatorAppResult } from '~/components/second-factor-settings.tsx'
import { rejectForm } from '~/form-replies.server.ts'
import type { FormRejection } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/settings`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<
  ReturnType<typeof data<AuthenticatorAppResult>> | FormRejection
> => {
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: confirmPasswordSchema })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }

  const { password } = submission.value
  const result = submission.reply({ resetForm: true })
  try {
    return formData.get(`intent`) === `turn-off`
      ? data({ result }, { headers: await turnOff(password, request.headers) })
      : data({
          result,
          recoveryCodes: await makeNewCodes(password, request.headers),
        })
  } catch (error) {
    if (
      error instanceof APIError &&
      error.body?.code === `TWO_FACTOR_NOT_ENABLED`
    ) {
      return rejectForm(submission, {
        formErrors: [`Your authenticator app is off. Reload the page`],
      })
    }
    return rejectAuthError(submission, error, { passwordField: `password` })
  }
}

/**
 * Resolves to the headers that set the new session's cookie, since Better Auth
 * replaces the session once the app turns off
 */
const turnOff = async (password: string, headers: Headers): Promise<Headers> =>
  (
    await auth.api.disableTwoFactor({
      body: { password },
      headers,
      returnHeaders: true,
    })
  ).headers

/** The new codes replace every earlier one */
const makeNewCodes = async (
  password: string,
  headers: Headers,
): Promise<string[]> =>
  (await auth.api.generateBackupCodes({ body: { password }, headers }))
    .backupCodes
