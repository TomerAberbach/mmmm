import { parseWithZod } from '@conform-to/zod/v4'
import { APIError } from 'better-auth/api'
import { redirect } from 'react-router'
import type { Route } from './+types/sign-in.ts'
import { signInSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import { CheckEmail } from '~/components/check-email.tsx'
import { SignInForm } from '~/components/sign-in-form.tsx'
import type { SignInNotice } from '~/components/sign-in-form.tsx'
import {
  rejectAuthError,
  rejectSubmission,
} from '~/reject-submission.server.ts'
import { readSignedInEducator } from '~/session.server.ts'

export const loader = async ({ request, context }: Route.LoaderArgs) =>
  (await readSignedInEducator(context))
    ? redirect(`/`)
    : { notice: readNotice(new URL(request.url).searchParams) }

// A confirmation link returns here with `confirmed`, plus an `error` when it
// fails. A password reset returns here with `password-reset`
const readNotice = (params: URLSearchParams): SignInNotice | undefined => {
  if (params.has(`error`)) {
    return `link-invalid`
  }
  if (params.has(`password-reset`)) {
    return `password-reset`
  }
  return params.has(`confirmed`) ? `confirmed` : undefined
}

export const action = async ({ request }: Route.ActionArgs) => {
  const submission = parseWithZod(await request.formData(), {
    schema: signInSchema,
  })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }

  const { email, password } = submission.value
  try {
    const { headers } = await auth.api.signInEmail({
      body: { email, password },
      headers: request.headers,
      returnHeaders: true,
    })
    return redirect(`/`, { headers })
  } catch (error) {
    if (error instanceof APIError) {
      if (error.body?.code === `EMAIL_NOT_VERIFIED`) {
        return { unconfirmed: email }
      }
      if (error.body?.code === `INVALID_EMAIL_OR_PASSWORD`) {
        return rejectSubmission(submission, {
          formErrors: [`Email address or password is incorrect`],
        })
      }
    }
    return rejectAuthError(submission, error)
  }
}

const SignIn = ({ loaderData, actionData }: Route.ComponentProps) =>
  actionData && `unconfirmed` in actionData ? (
    <CheckEmail email={actionData.unconfirmed} reason='unconfirmed' />
  ) : (
    <SignInForm lastResult={actionData?.result} notice={loaderData.notice} />
  )
export default SignIn
