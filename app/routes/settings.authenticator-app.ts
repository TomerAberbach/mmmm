import { parseWithZod } from '@conform-to/zod/v4'
import { data, redirect } from 'react-router'
import type { Route } from './+types/settings.authenticator-app.ts'
import { confirmPasswordSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import type { AuthenticatorAppResult } from '~/components/second-factor-settings.tsx'
import {
  rejectAuthError,
  rejectSubmission,
} from '~/reject-submission.server.ts'

export const loader = (): Response => redirect(`/settings`)

export const action = async ({
  request,
}: Route.ActionArgs): Promise<
  | ReturnType<typeof data<AuthenticatorAppResult>>
  | ReturnType<typeof rejectSubmission>
> => {
  const formData = await request.formData()
  const submission = parseWithZod(formData, { schema: confirmPasswordSchema })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
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
    return rejectAuthError(submission, error, { passwordField: `password` })
  }
}

// Resolves to the headers that set the new session's cookie, since Better Auth
// replaces the session once the app turns off
const turnOff = async (password: string, headers: Headers): Promise<Headers> =>
  (
    await auth.api.disableTwoFactor({
      body: { password },
      headers,
      returnHeaders: true,
    })
  ).headers

// The new codes replace every earlier one
const makeNewCodes = async (
  password: string,
  headers: Headers,
): Promise<string[]> =>
  (await auth.api.generateBackupCodes({ body: { password }, headers }))
    .backupCodes
