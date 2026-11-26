import { randomUUID } from 'node:crypto'
import { RouterContextProvider } from 'react-router'
import { vi } from 'vitest'
import { auth } from '../app/auth.server.ts'
import { CLIENT_IP_HEADER } from '../app/client-ip.ts'
import { prisma } from '../app/db.server.ts'
import {
  createSetupLinkToken,
  redeemSetupLink,
  storeSetupLinkToken,
} from '../app/second-factor.server.ts'
import {
  loadSignedInEducator,
  requireSignedInEducator,
} from '../app/session.server.ts'
import { readTotpCode } from './totp.ts'

export const PASSWORD = `correct-horse-battery`

/**
 * Each test uses its own IP address, since the auth limits count across the
 * process
 */
export const randomIp = (): string =>
  `10.${Array.from({ length: 3 }, () => Math.floor(Math.random() * 256)).join(`.`)}`

export type SignedIn = { educatorId: string; email: string; headers: Headers }

export const signInConfirmed = async (): Promise<SignedIn> => {
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

export const signInAdmin = async (): Promise<SignedIn> => {
  const signedIn = await signInConfirmed()
  vi.stubEnv(`ADMIN_LIST`, signedIn.email)
  return signedIn
}

/** The request headers of a browser holding the cookies a response set */
export const withCookies = (response: Headers, ip: string): Headers =>
  new Headers({
    cookie: response
      .getSetCookie()
      .map(setCookie => setCookie.split(`;`)[0])
      .join(`; `),
    [CLIENT_IP_HEADER]: ip,
  })

/** Returns the stored link's token */
export const addSetupLink = async (educatorId: string): Promise<string> => {
  const token = createSetupLinkToken()
  await storeSetupLinkToken(educatorId, token)
  return token
}

export const readSessionId = async (educatorId: string): Promise<string> => {
  const { id } = await prisma.session.findFirstOrThrow({
    where: { educatorId },
  })
  return id
}

export const redeemNewSetupLink = async ({
  educatorId,
}: SignedIn): Promise<void> => {
  const token = await addSetupLink(educatorId)
  await redeemSetupLink(token, educatorId, await readSessionId(educatorId))
}

export const turnOnAuthenticatorApp = async (
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

/** Stores a passkey no device holds, and returns its ID */
export const addPasskey = async (educatorId: string): Promise<string> => {
  const id = randomUUID()
  await prisma.passkey.create({
    data: {
      id,
      educatorId,
      publicKey: `key`,
      credentialID: id,
      counter: 0,
      deviceType: `multiDevice`,
      backedUp: true,
      createdAt: new Date(),
    },
  })
  return id
}

/** Marks the educator's sessions as having used a second factor just now */
export const proveSecondFactor = async (educatorId: string): Promise<void> => {
  await prisma.session.updateMany({
    where: { educatorId },
    data: { assurance: `SECOND_FACTOR`, secondFactorUsedAt: new Date() },
  })
}

type RunRoute = (args: never) => unknown

/** Runs a route's loader, action, or middleware as the signed-in educator */
export const runSignedIn = async (
  { headers }: SignedIn,
  route: RunRoute,
  request: Request = new Request(`http://localhost/`),
  params: Record<string, string> = {},
  next?: () => unknown,
): Promise<unknown> => {
  const context = new RouterContextProvider()
  for (const [name, value] of headers) {
    request.headers.set(name, value)
  }
  const url = new URL(request.url)
  const args = { request, url, context, params } as never
  let result: unknown
  await loadSignedInEducator(
    args,
    () =>
      requireSignedInEducator(args, async () => {
        result = await (route as (...args: unknown[]) => unknown)(args, next)
        return new Response()
      }) as Promise<Response>,
  )
  return result
}

/** A form's post */
export const formPost = (
  fields: Record<string, string>,
  url = `http://localhost/`,
): Request =>
  new Request(url, { method: `POST`, body: new URLSearchParams(fields) })

/** Signs in as an admin whose authenticator app is on */
export const signInWithApp = async (): Promise<SignedIn> => {
  const admin = await signInAdmin()
  await redeemNewSetupLink(admin)
  const { headers } = await turnOnAuthenticatorApp(admin)
  return { ...admin, headers }
}
