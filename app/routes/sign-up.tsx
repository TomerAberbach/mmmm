import { parseWithZod } from '@conform-to/zod/v4'
import type { Route } from './+types/sign-up.ts'
import { serverNameSchema } from '~/auth-forms.server.ts'
import { signUpSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import { CheckEmail } from '~/components/check-email.tsx'
import { SignUpForm } from '~/components/sign-up-form.tsx'
import { rejectAuthError, rejectSubmission } from '~/form-replies.server.ts'

const SERVER_SIGN_UP_SCHEMA = signUpSchema.extend(serverNameSchema.shape)

export const action = async ({ request }: Route.ActionArgs) => {
  const submission = parseWithZod(await request.formData(), {
    schema: SERVER_SIGN_UP_SCHEMA,
  })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }

  const { name, email, password } = submission.value
  try {
    await auth.api.signUpEmail({
      body: { name, email, password },
      headers: request.headers,
    })
  } catch (error) {
    return rejectAuthError(submission, error)
  }
  return { sentTo: email }
}

const SignUp = ({ actionData }: Route.ComponentProps) =>
  actionData && `sentTo` in actionData ? (
    <CheckEmail email={actionData.sentTo} reason='signed-up' />
  ) : (
    <SignUpForm lastResult={actionData?.result} />
  )
export default SignUp
