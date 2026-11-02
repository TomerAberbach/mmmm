import { randomUUID } from 'node:crypto'
import { expect, test, vi } from 'vitest'
import { readTotpCode } from '../test/totp.ts'
import { auth } from './auth.server.ts'
import { CLIENT_IP_HEADER } from './client-ip.ts'
import { prisma } from './db.server.ts'
import {
  createSetupLinkToken,
  markSetupLinkUsed,
  mayChangeSecondFactors,
  redeemSetupLinkToken,
} from './second-factor.server.ts'
import { LAST_SECOND_FACTOR, SECOND_FACTOR_REQUIRED } from './second-factor.ts'

const PASSWORD = `correct-horse-battery`

// Each test uses its own IP address, since the auth limits count across the
// process
const randomIp = (): string =>
  `10.${Array.from({ length: 3 }, () => Math.floor(Math.random() * 256)).join(`.`)}`

type SignedIn = { educatorId: string; email: string; headers: Headers }

const signInConfirmed = async (): Promise<SignedIn> => {
  const email = `educator-${randomUUID()}@example.com`
  const ip = randomIp()
  const { user } = await auth.api.signUpEmail({
    body: { name: `Ms. Frizzle`, email, password: PASSWORD },
    headers: new Headers({ [CLIENT_IP_HEADER]: ip }),
  })
  await prisma.educator.update({
    where: { id: user.id },
    data: { emailVerified: true },
  })
  const { headers } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: new Headers({ [CLIENT_IP_HEADER]: ip }),
    returnHeaders: true,
  })
  return { educatorId: user.id, email, headers: withCookies(headers, ip) }
}

const signInAdmin = async (): Promise<SignedIn> => {
  const signedIn = await signInConfirmed()
  vi.stubEnv(`ADMIN_LIST`, signedIn.email)
  return signedIn
}

// The request headers of a browser holding the cookies a response set
const withCookies = (response: Headers, ip: string): Headers =>
  new Headers({
    cookie: response
      .getSetCookie()
      .map(setCookie => setCookie.split(`;`)[0])
      .join(`; `),
    [CLIENT_IP_HEADER]: ip,
  })

const readAssurances = async (educatorId: string) =>
  (await prisma.session.findMany({ where: { educatorId } })).map(
    ({ assurance }) => assurance,
  )

const useSetupLink = async ({ educatorId }: SignedIn): Promise<void> => {
  const token = await createSetupLinkToken(educatorId)
  await redeemSetupLinkToken(token, educatorId)
  const session = await prisma.session.findFirstOrThrow({
    where: { educatorId },
  })
  await markSetupLinkUsed(session.id)
}

const turnOnAuthenticatorApp = async (
  signedIn: SignedIn,
): Promise<{ totpUri: string; headers: Headers }> => {
  const enabled = await auth.api.enableTwoFactor({
    body: { password: PASSWORD },
    headers: signedIn.headers,
  })
  if (enabled.method !== `totp`) {
    throw new Error(`Expected TOTP`)
  }
  const { headers } = await auth.api.verifyTOTP({
    body: { code: readTotpCode(enabled.totpURI) },
    headers: signedIn.headers,
    returnHeaders: true,
  })
  return {
    totpUri: enabled.totpURI,
    headers: withCookies(headers, randomIp()),
  }
}

test.each([
  { assurance: `PASSWORD`, hasAuthenticatorApp: false, mayChange: false },
  { assurance: `PASSWORD`, hasAuthenticatorApp: true, mayChange: false },
  { assurance: `SETUP_LINK`, hasAuthenticatorApp: false, mayChange: true },
  { assurance: `SETUP_LINK`, hasAuthenticatorApp: true, mayChange: false },
  { assurance: `SECOND_FACTOR`, hasAuthenticatorApp: true, mayChange: true },
] as const)(
  `a $assurance session, with an authenticator app: $hasAuthenticatorApp, may change second factors: $mayChange`,
  ({ assurance, hasAuthenticatorApp, mayChange }) => {
    const secondFactors = { passkeys: [], hasAuthenticatorApp }

    expect(mayChangeSecondFactors(assurance, secondFactors)).toBe(mayChange)
  },
)

test(`a password alone can't add an admin's first second factor`, async () => {
  const admin = await signInAdmin()

  const enabling = auth.api.enableTwoFactor({
    body: { password: PASSWORD },
    headers: admin.headers,
  })

  await expect(enabling).rejects.toMatchObject({
    body: { code: SECOND_FACTOR_REQUIRED },
  })
})

test(`educators off the admin list can't add a second factor`, async () => {
  const educator = await signInConfirmed()
  await useSetupLink(educator)

  const enabling = auth.api.enableTwoFactor({
    body: { password: PASSWORD },
    headers: educator.headers,
  })

  await expect(enabling).rejects.toMatchObject({
    body: { code: SECOND_FACTOR_REQUIRED },
  })
})

test(`turning on an authenticator app after a setup link counts as using it`, async () => {
  const admin = await signInAdmin()
  await useSetupLink(admin)

  await turnOnAuthenticatorApp(admin)

  await expect(readAssurances(admin.educatorId)).resolves.toStrictEqual([
    `SECOND_FACTOR`,
  ])
})

test(`signing in with an authenticator app's code uses a second factor`, async () => {
  const admin = await signInAdmin()
  await useSetupLink(admin)
  const { totpUri } = await turnOnAuthenticatorApp(admin)
  await prisma.session.deleteMany({ where: { educatorId: admin.educatorId } })
  const ip = randomIp()
  const { headers: challenge } = await auth.api.signInEmail({
    body: { email: admin.email, password: PASSWORD },
    headers: new Headers({ [CLIENT_IP_HEADER]: ip }),
    returnHeaders: true,
  })

  const { headers } = await auth.api.verifyTOTP({
    body: { code: readTotpCode(totpUri), trustDevice: true },
    headers: withCookies(challenge, ip),
    returnHeaders: true,
  })

  await expect(readAssurances(admin.educatorId)).resolves.toStrictEqual([
    `SECOND_FACTOR`,
  ])
  expect(headers.getSetCookie().join(`\n`)).not.toContain(`trust_device`)
})

test(`an admin can't remove their last second factor`, async () => {
  const admin = await signInAdmin()
  await useSetupLink(admin)
  const { headers } = await turnOnAuthenticatorApp(admin)

  const disabling = auth.api.disableTwoFactor({
    body: { password: PASSWORD },
    headers,
  })

  await expect(disabling).rejects.toMatchObject({
    body: { code: LAST_SECOND_FACTOR },
  })
})

test(`a former admin removes their last second factor`, async () => {
  const admin = await signInAdmin()
  await useSetupLink(admin)
  const { headers } = await turnOnAuthenticatorApp(admin)
  vi.stubEnv(`ADMIN_LIST`, ``)

  await auth.api.disableTwoFactor({ body: { password: PASSWORD }, headers })

  const educator = await prisma.educator.findUniqueOrThrow({
    where: { id: admin.educatorId },
  })
  expect(educator.twoFactorEnabled).toBe(false)
})

test(`a setup link works once`, async () => {
  const { educatorId } = await signInConfirmed()
  const token = await createSetupLinkToken(educatorId)

  const redeemed = [
    await redeemSetupLinkToken(token, educatorId),
    await redeemSetupLinkToken(token, educatorId),
  ]

  expect(redeemed).toStrictEqual([true, false])
})

test(`a setup link works only for its own educator`, async () => {
  const owner = await signInConfirmed()
  const other = await signInConfirmed()
  const token = await createSetupLinkToken(owner.educatorId)

  const redeemed = await redeemSetupLinkToken(token, other.educatorId)

  expect(redeemed).toBe(false)
})

test(`a new setup link replaces the educator's earlier one`, async () => {
  const { educatorId } = await signInConfirmed()
  const earlier = await createSetupLinkToken(educatorId)
  await createSetupLinkToken(educatorId)

  const redeemed = await redeemSetupLinkToken(earlier, educatorId)

  expect(redeemed).toBe(false)
})

test(`a setup link expires after an hour`, async () => {
  const { educatorId } = await signInConfirmed()
  const token = await createSetupLinkToken(educatorId)
  vi.useFakeTimers({ now: Date.now() + 61 * 60 * 1000, toFake: [`Date`] })

  const redeemed = await redeemSetupLinkToken(token, educatorId)

  expect(redeemed).toBe(false)
})
