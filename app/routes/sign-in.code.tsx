import { parseWithZod } from '@conform-to/zod/v4'
import type { Route } from './+types/sign-in.code.ts'
import { INCORRECT_CODE_MESSAGE, securityCodeFormSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import { SignInCodeForm } from '~/components/sign-in-code-form.tsx'
import { readReturnPath } from '~/return-path.ts'
import { answerSignInChallenge } from '~/sign-in-challenge.server.ts'

export const loader = ({ request }: Route.LoaderArgs) => ({
  returnPath: readReturnPath(request),
})

export const action = async ({ request }: Route.ActionArgs) =>
  answerSignInChallenge(
    request,
    parseWithZod(await request.formData(), { schema: securityCodeFormSchema }),
    code =>
      auth.api.verifyTOTP({
        body: { code },
        headers: request.headers,
        returnHeaders: true,
      }),
    INCORRECT_CODE_MESSAGE,
  )

const SignInCode = ({ loaderData, actionData }: Route.ComponentProps) => (
  <SignInCodeForm
    lastResult={actionData?.result}
    returnPath={loaderData.returnPath}
  />
)
export default SignInCode
