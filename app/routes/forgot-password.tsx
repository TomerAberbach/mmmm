import { parseWithZod } from '@conform-to/zod/v4'
import type { Route } from './+types/forgot-password.ts'
import { forgotPasswordSchema } from '~/auth-forms.ts'
import { rejectAuthError } from '~/auth-replies.server.ts'
import { auth } from '~/auth.server.ts'
import {
  ForgotPasswordForm,
  ResetLinkSent,
} from '~/components/forgot-password-form.tsx'
import { rejectForm } from '~/form-replies.server.ts'
import { readSignedInEducator } from '~/session.server.ts'

export const loader = async ({ request, context }: Route.LoaderArgs) => ({
  linkInvalid: new URL(request.url).searchParams.has(`link-invalid`),
  isSignedIn: (await readSignedInEducator(context)) !== null,
})

export const action = async ({ request }: Route.ActionArgs) => {
  const submission = parseWithZod(await request.formData(), {
    schema: forgotPasswordSchema,
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }

  const { email } = submission.value
  try {
    await auth.api.requestPasswordReset({
      body: { email },
      headers: request.headers,
    })
  } catch (error) {
    return rejectAuthError(submission, error)
  }
  return { sentTo: email }
}

const ForgotPassword = ({ loaderData, actionData }: Route.ComponentProps) =>
  actionData && `sentTo` in actionData ? (
    <ResetLinkSent
      email={actionData.sentTo}
      isSignedIn={loaderData.isSignedIn}
    />
  ) : (
    <ForgotPasswordForm
      lastResult={actionData?.result}
      linkInvalid={loaderData.linkInvalid}
      isSignedIn={loaderData.isSignedIn}
    />
  )
export default ForgotPassword
