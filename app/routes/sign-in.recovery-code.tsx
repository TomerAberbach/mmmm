import { parseWithZod } from '@conform-to/zod/v4'
import { useRouteLoaderData } from 'react-router'
import type { Route } from './+types/sign-in.recovery-code.ts'
import { recoveryCodeSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import { RecoveryCodeForm } from '~/components/sign-in-code-form.tsx'
import { readReturnPath } from '~/return-path.ts'
import type { loader as rootLoader } from '~/root.tsx'
import { answerSignInChallenge } from '~/sign-in-challenge.server.ts'

export const loader = ({ request }: Route.LoaderArgs) => ({
  returnPath: readReturnPath(request),
})

export const action = async ({ request }: Route.ActionArgs) =>
  answerSignInChallenge(
    request,
    parseWithZod(await request.formData(), { schema: recoveryCodeSchema }),
    code =>
      auth.api.verifyBackupCode({
        body: { code },
        headers: request.headers,
        returnHeaders: true,
      }),
    `That recovery code is incorrect or already used`,
  )

const SignInRecoveryCode = ({
  loaderData,
  actionData,
}: Route.ComponentProps) => {
  const supportEmail =
    useRouteLoaderData<typeof rootLoader>(`root`)?.supportEmail ?? ``
  return (
    <RecoveryCodeForm
      lastResult={actionData?.result}
      returnPath={loaderData.returnPath}
      supportEmail={supportEmail}
    />
  )
}
export default SignInRecoveryCode
