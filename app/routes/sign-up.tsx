import { parseWithZod } from '@conform-to/zod/v4'
import type { Route } from './+types/sign-up.ts'
import { signUpSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import { CheckEmail } from '~/components/check-email.tsx'
import { SignUpForm } from '~/components/sign-up-form.tsx'
import { rejectAuthError, rejectForm } from '~/form-replies.server.ts'
import { serverFreeTextSchema } from '~/free-text.server.ts'

export const action = async ({ request }: Route.ActionArgs) => {
  const submission = parseWithZod(await request.formData(), {
    schema: signUpSchema(serverFreeTextSchema),
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
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
