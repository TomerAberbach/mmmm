import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.setup.ts'
import {
  SecondFactorChoice,
  SetupLinkRequest,
} from '~/components/second-factor-setup.tsx'
import { sendEmail } from '~/email.server.ts'
import { secondFactorSetupEmail } from '~/emails/second-factor-setup.server.tsx'
import { toAppUrl } from '~/env.server.ts'
import {
  createSetupLinkToken,
  hasSecondFactor,
  markSetupLinkUsed,
  readSecondFactors,
  redeemSetupLinkToken,
} from '~/second-factor.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

const SETUP_URL = toAppUrl(href(`/admin/setup`))

// Only for an admin without a second factor. The emailed link returns here
// with its token, which this browser's session uses up. A session that
// already used one skips the token, so opening the email again doesn't call
// the used link invalid
export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const educator = readRequiredEducator(context)
  const session = readRequiredSession(context)
  if (hasSecondFactor(await readSecondFactors(educator.id))) {
    return redirect(href(`/admin`))
  }
  if (session.assurance !== `PASSWORD`) {
    return new URL(request.url).search
      ? redirect(href(`/admin/setup`))
      : ({ step: `choose` } as const)
  }
  const token = new URL(request.url).searchParams.get(`token`)
  if (token !== null && (await redeemSetupLinkToken(token, educator.id))) {
    await markSetupLinkUsed(session.id)
    return redirect(href(`/admin/setup`))
  }
  return {
    step: `request`,
    email: educator.email,
    linkInvalid: token !== null,
  } as const
}

export const action = async ({ context }: Route.ActionArgs) => {
  const educator = readRequiredEducator(context)
  if (hasSecondFactor(await readSecondFactors(educator.id))) {
    return redirect(href(`/admin`))
  }
  const url = new URL(SETUP_URL)
  url.searchParams.set(`token`, await createSetupLinkToken(educator.id))
  await sendEmail(secondFactorSetupEmail({ to: educator.email, url: url.href }))
  return { sent: true } as const
}

const AdminSetup = ({ loaderData, actionData }: Route.ComponentProps) =>
  loaderData.step === `request` ? (
    <SetupLinkRequest
      email={loaderData.email}
      linkInvalid={loaderData.linkInvalid}
      isSent={actionData?.sent === true}
    />
  ) : (
    <SecondFactorChoice />
  )
export default AdminSetup
