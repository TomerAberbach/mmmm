import { parseWithZod } from '@conform-to/zod/v4'
import { APIError } from 'better-auth/api'
import { redirect } from 'react-router'
import type { Route } from './+types/reset-password.ts'
import { resetPasswordSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import { ResetPasswordForm } from '~/components/reset-password-form.tsx'
import { rejectSubmission } from '~/reject-submission.server.ts'

const LINK_INVALID_URL = `/forgot-password?link-invalid`

// A reset link returns here with `token`, or with `error` when it expired or
// was used
export const loader = ({ request }: Route.LoaderArgs) => {
  const token = new URL(request.url).searchParams.get(`token`)
  return token ? { token } : redirect(LINK_INVALID_URL)
}

export const action = async ({ request }: Route.ActionArgs) => {
  const submission = parseWithZod(await request.formData(), {
    schema: resetPasswordSchema,
  })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }

  const { token, password } = submission.value
  try {
    await auth.api.resetPassword({ body: { token, newPassword: password } })
  } catch (error) {
    // The educator is gone when someone signed up again before the reset
    if (
      error instanceof APIError &&
      (error.body?.code === `INVALID_TOKEN` ||
        error.body?.code === `USER_NOT_FOUND`)
    ) {
      return redirect(LINK_INVALID_URL)
    }
    throw error
  }
  return redirect(`/sign-in?password-reset`)
}

const ResetPassword = ({ loaderData, actionData }: Route.ComponentProps) => (
  <ResetPasswordForm token={loaderData.token} lastResult={actionData?.result} />
)
export default ResetPassword
