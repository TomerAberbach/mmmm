import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.verify.ts'
import { VerifySecondFactor } from '~/components/verify-second-factor.tsx'
import { hasSecondFactor, readSecondFactors } from '~/second-factor.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

export const loader = async ({ context }: Route.LoaderArgs) => {
  if (readRequiredSession(context).assurance === `SECOND_FACTOR`) {
    return redirect(href(`/admin`))
  }
  const secondFactors = await readSecondFactors(
    readRequiredEducator(context).id,
  )
  return hasSecondFactor(secondFactors)
    ? { hasPasskey: secondFactors.passkeys.length > 0 }
    : redirect(href(`/admin`))
}

const AdminVerify = ({ loaderData }: Route.ComponentProps) => (
  <VerifySecondFactor hasPasskey={loaderData.hasPasskey} />
)
export default AdminVerify
