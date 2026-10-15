import { redirect } from 'react-router'
import type { Route } from './+types/admin.verify.ts'
import { VerifySecondFactor } from '~/components/verify-second-factor.tsx'
import {
  readSecondFactors,
  readSecondFactorStep,
} from '~/second-factor.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

export const loader = async ({ context }: Route.LoaderArgs) => {
  if (readRequiredSession(context).assurance === `SECOND_FACTOR`) {
    return redirect(`/admin`)
  }
  const secondFactors = await readSecondFactors(
    readRequiredEducator(context).id,
  )
  const step = readSecondFactorStep(secondFactors)
  return step === `/admin/verify`
    ? { hasPasskey: secondFactors.passkeys.length > 0 }
    : redirect(step)
}

const AdminVerify = ({ loaderData }: Route.ComponentProps) => (
  <VerifySecondFactor hasPasskey={loaderData.hasPasskey} />
)
export default AdminVerify
