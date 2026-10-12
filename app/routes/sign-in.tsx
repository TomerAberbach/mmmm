import { parseWithZod } from '@conform-to/zod/v4'
import { APIError } from 'better-auth/api'
import { redirect } from 'react-router'
import type { Route } from './+types/sign-in.ts'
import { signInSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import { CheckEmail } from '~/components/check-email.tsx'
import { SignInForm } from '~/components/sign-in-form.tsx'
import type { SignInNotice } from '~/components/sign-in-form.tsx'
import { rejectSubmission } from '~/reject-submission.server.ts'
import { readSignedInEducator } from '~/session.server.ts'

export const loader = async ({ request, context }: Route.LoaderArgs) =>
  (await readSignedInEducator(context))
    ? redirect(`/`)
    : { notice: readNotice(new URL(request.url).searchParams) }

// A confirmation link returns here with `confirmed`, plus an `error` when it
// fails
const readNotice = (params: URLSearchParams): SignInNotice | undefined => {
  if (params.has(`error`)) {
    return `link-invalid`
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
    if (!(error instanceof APIError)) {
      throw error
    }
    // Signing in resends the confirmation link
    if (error.body?.code === `EMAIL_NOT_VERIFIED`) {
      return { sentTo: email }
    }
    return rejectSubmission(submission, {
      formErrors: [`Email address or password is incorrect`],
    })
  }
}

const SignIn = ({ loaderData, actionData }: Route.ComponentProps) =>
  actionData && `sentTo` in actionData ? (
    <CheckEmail email={actionData.sentTo} />
  ) : (
    <SignInForm lastResult={actionData?.result} notice={loaderData.notice} />
  )
export default SignIn
