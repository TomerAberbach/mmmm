import { parseWithZod } from '@conform-to/zod/v4'
import { redirect, useRouteLoaderData } from 'react-router'
import type { Route } from './+types/sign-in.recovery-code.ts'
import { recoveryCodeSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import { RecoveryCodeForm } from '~/components/sign-in-code-form.tsx'
import type { loader as rootLoader } from '~/root.tsx'
import { readSignedInEducator } from '~/session.server.ts'
import { answerSignInChallenge } from '~/sign-in-challenge.server.ts'

export const loader = async ({ context }: Route.LoaderArgs) =>
  (await readSignedInEducator(context)) ? redirect(`/`) : null

export const action = async ({ request }: Route.ActionArgs) =>
  answerSignInChallenge(
    parseWithZod(await request.formData(), { schema: recoveryCodeSchema }),
    code =>
      auth.api.verifyBackupCode({
        body: { code },
        headers: request.headers,
        returnHeaders: true,
      }),
    `That recovery code is incorrect or already used`,
  )

const SignInRecoveryCode = ({ actionData }: Route.ComponentProps) => {
  const supportEmail =
    useRouteLoaderData<typeof rootLoader>(`root`)?.supportEmail ?? ``
  return (
    <RecoveryCodeForm
      lastResult={actionData?.result}
      supportEmail={supportEmail}
    />
  )
}
export default SignInRecoveryCode
