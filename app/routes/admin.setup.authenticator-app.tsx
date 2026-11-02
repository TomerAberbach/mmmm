import { parseWithZod } from '@conform-to/zod/v4'
import { APIError } from 'better-auth/api'
import { data, redirect } from 'react-router'
import type { ShouldRevalidateFunctionArgs } from 'react-router'
import type { Route } from './+types/admin.setup.authenticator-app.ts'
import {
  confirmPasswordSchema,
  INCORRECT_CODE_MESSAGE,
  securityCodeFormSchema,
} from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import {
  ConfirmPasswordStep,
  ScanStep,
} from '~/components/authenticator-app-setup.tsx'
import { RecoveryCodes } from '~/components/recovery-codes.tsx'
import { rejectAuthError, rejectSubmission } from '~/form-replies.server.ts'
import {
  mayChangeSecondFactors,
  readSecondFactors,
  readSecondFactorStep,
} from '~/second-factor.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

// Opens for a session that may add a second factor, until the educator has an
// authenticator app
export const loader = async ({ context }: Route.LoaderArgs) => {
  const { assurance } = readRequiredSession(context)
  const secondFactors = await readSecondFactors(
    readRequiredEducator(context).id,
  )
  if (secondFactors.hasAuthenticatorApp) {
    return redirect(`/admin`)
  }
  return mayChangeSecondFactors(assurance, secondFactors)
    ? null
    : redirect(readSecondFactorStep(secondFactors))
}

// The loader sends an educator with an app away, so once the app turns on,
// skipping it keeps the recovery codes on screen
export const shouldRevalidate = ({
  actionResult,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean =>
  (actionResult as { step?: Step } | undefined)?.step !== `codes` &&
  defaultShouldRevalidate

// The step the page shows next. Without an action result, it asks for the
// password
type Step = `password` | `scan` | `codes`

const rejectPassword = ({
  data: reply,
  init,
}: ReturnType<typeof rejectSubmission>) =>
  data({ step: `password` as const, ...reply }, init ?? undefined)

export const action = async ({ request, context }: Route.ActionArgs) => {
  const formData = await request.formData()
  return formData.get(`intent`) === `turn-on`
    ? turnOn(request, formData, readRequiredEducator(context).id)
    : start(request, formData)
}

// Makes the app's secret, which stays off until a code from the app matches
const start = async (request: Request, formData: FormData) => {
  const submission = parseWithZod(formData, { schema: confirmPasswordSchema })
  if (submission.status !== `success`) {
    return rejectPassword(rejectSubmission(submission))
  }
  try {
    const enabled = await auth.api.enableTwoFactor({
      body: { password: submission.value.password, method: `totp` },
      headers: request.headers,
    })
    if (enabled.method !== `totp`) {
      throw new Error(`Better Auth enabled ${enabled.method} instead of TOTP`)
    }
    return { step: `scan`, totpUri: enabled.totpURI } as const
  } catch (error) {
    return rejectPassword(
      rejectAuthError(submission, error, { passwordField: `password` }),
    )
  }
}

// Better Auth replaces the session once the app turns on, so the response
// sets the new session's cookie
const turnOn = async (
  request: Request,
  formData: FormData,
  educatorId: string,
) => {
  const submission = parseWithZod(formData, {
    schema: securityCodeFormSchema,
  })
  const totpUri = formData.get(`totpUri`)
  // Only an altered form loses the URI. Starting over makes a new one
  if (typeof totpUri !== `string` || !URL.canParse(totpUri)) {
    return redirect(`/admin/setup/authenticator-app`)
  }
  // Sends the URI back, so the page shows the same QR code again
  const rejectScan = (errors?: Parameters<typeof rejectSubmission>[1]) =>
    data(
      {
        step: `scan` as const,
        totpUri,
        ...rejectSubmission(submission, errors).data,
      },
      400,
    )
  if (submission.status !== `success`) {
    return rejectScan()
  }
  try {
    const { headers } = await auth.api.verifyTOTP({
      body: { code: submission.value.code },
      headers: request.headers,
      returnHeaders: true,
    })
    const { backupCodes } = await auth.api.viewBackupCodes({
      body: { userId: educatorId },
      headers: request.headers,
    })
    return data({ step: `codes`, recoveryCodes: backupCodes } as const, {
      headers,
    })
  } catch (error) {
    if (error instanceof APIError && error.body?.code === `INVALID_CODE`) {
      return rejectScan({ fieldErrors: { code: [INCORRECT_CODE_MESSAGE] } })
    }
    throw error
  }
}

const AuthenticatorAppSetup = ({ actionData }: Route.ComponentProps) => {
  switch (actionData?.step) {
    case `codes`:
      return (
        <RecoveryCodes codes={actionData.recoveryCodes} continueTo='/admin' />
      )
    case `scan`:
      return (
        <ScanStep
          totpUri={actionData.totpUri}
          lastResult={`result` in actionData ? actionData.result : undefined}
        />
      )
    case `password`:
    case undefined:
      return <ConfirmPasswordStep lastResult={actionData?.result} />
  }
}
export default AuthenticatorAppSetup
