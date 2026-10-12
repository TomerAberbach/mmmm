import { parseWithZod } from '@conform-to/zod/v4'
import { APIError } from 'better-auth/api'
import { redirect } from 'react-router'
import type { Route } from './+types/sign-up.ts'
import { INVALID_EMAIL_MESSAGE, signUpSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import { CheckEmail } from '~/components/check-email.tsx'
import { SignUpForm } from '~/components/sign-up-form.tsx'
import { serverFreeTextSchema } from '~/free-text.server.ts'
import { EDUCATOR_NAME } from '~/free-text.ts'
import { rejectSubmission } from '~/reject-submission.server.ts'
import { readSignedInEducator } from '~/session.server.ts'

export const loader = async ({ context }: Route.LoaderArgs) =>
  (await readSignedInEducator(context)) ? redirect(`/`) : null

const SERVER_SIGN_UP_SCHEMA = signUpSchema.extend({
  name: serverFreeTextSchema(EDUCATOR_NAME),
})

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
    // Better Auth checks the address more strictly than the schema
    if (error instanceof APIError && error.body?.code === `INVALID_EMAIL`) {
      return rejectSubmission(submission, {
        fieldErrors: { email: [INVALID_EMAIL_MESSAGE] },
      })
    }
    throw error
  }
  return { sentTo: email }
}

const SignUp = ({ actionData }: Route.ComponentProps) =>
  actionData && `sentTo` in actionData ? (
    <CheckEmail email={actionData.sentTo} />
  ) : (
    <SignUpForm lastResult={actionData?.result} />
  )
export default SignUp
