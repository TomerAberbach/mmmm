import { parseWithZod } from '@conform-to/zod/v4'
import type { Route } from './+types/sign-in.code.ts'
import { INCORRECT_CODE_MESSAGE, securityCodeFormSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import { SignInCodeForm } from '~/components/sign-in-code-form.tsx'
import { answerSignInChallenge } from '~/sign-in-challenge.server.ts'

export const action = async ({ request }: Route.ActionArgs) =>
  answerSignInChallenge(
    parseWithZod(await request.formData(), { schema: securityCodeFormSchema }),
    code =>
      auth.api.verifyTOTP({
        body: { code },
        headers: request.headers,
        returnHeaders: true,
      }),
    INCORRECT_CODE_MESSAGE,
  )

const SignInCode = ({ actionData }: Route.ComponentProps) => (
  <SignInCodeForm lastResult={actionData?.result} />
)
export default SignInCode
