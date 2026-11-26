import { randomUUID } from 'node:crypto'
import { RouterContextProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import { waitForBlockedQuery } from '../test/locks.ts'
import {
  addPasskey,
  formPost,
  PASSWORD,
  proveSecondFactor,
  randomIp,
  redeemNewSetupLink,
  runSignedIn,
  signInAdmin,
  signInConfirmed,
  signInWithApp,
  turnOnAuthenticatorApp,
  withCookies,
} from '../test/sign-in.ts'
import type { SignedIn } from '../test/sign-in.ts'
import { readTotpCode } from '../test/totp.ts'
import { auth } from './auth.server.ts'
import { CLIENT_IP_HEADER } from './client-ip.ts'
import { prisma } from './db.server.ts'
import { sendEmail } from './email.server.ts'
import { passwordChangedEmail } from './emails/password-changed.server.tsx'
import { readMailbox } from './mailbox.server.ts'
import { loader as accountDeleted } from './routes/account-deleted.tsx'
import { action as deleteFromAdmin } from './routes/admin.educators.$educatorId.delete.ts'
import { middleware as secondFactorMiddleware } from './routes/admin.second-factor.tsx'
import { action as setUpApp } from './routes/admin.setup.authenticator-app.tsx'
import { action as sendSetupLink } from './routes/admin.setup.tsx'
import {
  loader as forgotPassword,
  action as requestReset,
} from './routes/forgot-password.tsx'
import { loader as settings } from './routes/settings._index.tsx'
import { action as changeApp } from './routes/settings.authenticator-app.ts'
import { action as removePasskeyAction } from './routes/settings.remove-passkey.ts'
import { action as enterCode } from './routes/sign-in.code.tsx'
import { action as enterRecoveryCode } from './routes/sign-in.recovery-code.tsx'
import { action as signIn } from './routes/sign-in.tsx'
import {
  loadSignedInEducator,
  requireSignedInEducator,
  requireSignedOut,
} from './session.server.ts'

const readLocation = (result: unknown): string | null =>
  result instanceof Response ? result.headers.get(`location`) : null

const [requireSecondFactor] = secondFactorMiddleware

const openAdminArea = async (admin: SignedIn, request?: Request) => {
  const next = vi.fn(() => Promise.resolve(new Response(`admin area`)))
  const response = await runSignedIn(
    admin,
    requireSecondFactor as never,
    request,
    {},
    next,
  )
  return { wasOpened: next.mock.calls.length > 0, response }
}

test(`a session that used a second factor opens the admin area`, async () => {
  const admin = await signInAdmin()
  await addPasskey(admin.educatorId)
  await proveSecondFactor(admin.educatorId)

  const { wasOpened } = await openAdminArea(admin)

  expect(wasOpened).toBe(true)
})

test(`a session that used a second factor its admin no longer has sets one up`, async () => {
  const admin = await signInAdmin()
  await proveSecondFactor(admin.educatorId)

  const { wasOpened, response } = await openAdminArea(admin)

  expect(wasOpened).toBe(false)
  expect(readLocation(response)).toBe(`/admin/setup`)
})

test(`a form posted after 12 hours runs no action`, async () => {
  const admin = await signInAdmin()
  await addPasskey(admin.educatorId)
  await prisma.session.updateMany({
    where: { educatorId: admin.educatorId },
    data: {
      assurance: `SECOND_FACTOR`,
      secondFactorUsedAt: new Date(Date.now() - 13 * 60 * 60 * 1000),
    },
  })

  const { wasOpened, response } = await openAdminArea(
    admin,
    formPost({}, `http://localhost/admin/bracket`),
  )

  expect(wasOpened).toBe(false)
  expect(readLocation(response)).toBe(`/admin/verify`)
})

/** Starts a sign-in that asks for a code */
const startSignIn = async (
  email: string,
  fields: Record<string, string>,
  url?: string,
): Promise<Request> => {
  const ip = randomIp()
  const { headers } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: new Headers({ [CLIENT_IP_HEADER]: ip }),
    returnHeaders: true,
  })
  const request = formPost(fields, url)
  for (const [name, value] of withCookies(headers, ip)) {
    request.headers.set(name, value)
  }
  return request
}

test.each([
  { page: `code`, action: enterCode },
  { page: `recovery code`, action: enterRecoveryCode },
])(
  `the $page page starts sign-in over once the app is gone`,
  async ({ action }) => {
    const { educatorId, email } = await signInWithApp()
    const request = await startSignIn(email, { code: `123456` })
    await prisma.authenticatorApp.deleteMany({ where: { educatorId } })

    const response = await action({ request } as never)

    expect(readLocation(response)).toBe(`/sign-in?challenge-expired`)
  },
)

const RETURN_URL = `http://localhost/sign-in?to=%2Fsettings`

test.each([
  { to: `/settings`, location: `/settings` },
  { to: `//evil.example`, location: `/contests` },
  { to: `/api/auth/get-session`, location: `/contests` },
])(`signing in to go to $to opens $location`, async ({ to, location }) => {
  const { email } = await signInConfirmed()
  const request = formPost(
    { email, password: PASSWORD },
    `http://localhost/sign-in?to=${encodeURIComponent(to)}`,
  )
  request.headers.set(CLIENT_IP_HEADER, randomIp())

  const response = await signIn({ request } as never)

  expect(readLocation(response)).toBe(location)
})

test(`signing in with an authenticator app keeps where the educator was going`, async () => {
  const { email } = await signInWithApp()
  const request = formPost({ email, password: PASSWORD }, RETURN_URL)
  request.headers.set(CLIENT_IP_HEADER, randomIp())

  const response = await signIn({ request } as never)

  expect(readLocation(response)).toBe(`/sign-in/code?to=%2Fsettings`)
})

test(`a security code opens the page the educator was going to`, async () => {
  const admin = await signInAdmin()
  await redeemNewSetupLink(admin)
  const { totpUri } = await turnOnAuthenticatorApp(admin)
  const request = await startSignIn(
    admin.email,
    { code: readTotpCode(totpUri) },
    `http://localhost/sign-in/code?to=%2Fsettings`,
  )

  const response = await enterCode({ request } as never)

  expect(readLocation(response)).toBe(`/settings`)
})

test(`a recovery code opens the page the educator was going to`, async () => {
  const { educatorId, email, headers } = await signInWithApp()
  const { backupCodes } = await auth.api.viewBackupCodes({
    body: { userId: educatorId },
    headers,
  })
  const request = await startSignIn(
    email,
    { code: backupCodes[0]! },
    `http://localhost/sign-in/recovery-code?to=%2Fsettings`,
  )

  const response = await enterRecoveryCode({ request } as never)

  expect(readLocation(response)).toBe(`/settings`)
})

test(`starting a sign-in over keeps where the educator was going`, async () => {
  const { educatorId, email } = await signInWithApp()
  const request = await startSignIn(
    email,
    { code: `123456` },
    `http://localhost/sign-in/code?to=%2Fsettings`,
  )
  await prisma.authenticatorApp.deleteMany({ where: { educatorId } })

  const response = await enterCode({ request } as never)

  expect(readLocation(response)).toBe(
    `/sign-in?challenge-expired&to=%2Fsettings`,
  )
})

test.each([
  { path: `/settings`, location: `/sign-in?to=%2Fsettings` },
  {
    path: `/admin/setup?token=secret`,
    location: `/sign-in?to=%2Fadmin%2Fsetup`,
  },
  { path: `/settings/delete-account`, location: `/sign-in` },
])(
  `a signed-out visitor to $path is sent to $location`,
  async ({ path, location }) => {
    const context = new RouterContextProvider()
    const args = {
      request: new Request(`http://localhost${path}`),
      url: new URL(path, `http://localhost`),
      context,
    } as never
    let redirected: unknown

    await loadSignedInEducator(args, async () => {
      redirected = await requireSignedInEducator(args, () =>
        Promise.resolve(new Response()),
      )
      return new Response()
    })

    expect(readLocation(redirected)).toBe(location)
  },
)

test.each([
  { to: `%2Fsettings`, location: `/settings` },
  { to: `%2F%2Fevil.example`, location: `/contests` },
])(
  `a signed-in educator who opens sign-in to go to $to opens $location`,
  async ({ to, location }) => {
    const educator = await signInConfirmed()

    const response = await runSignedIn(
      educator,
      requireSignedOut as never,
      new Request(`http://localhost/sign-in?to=${to}`),
    )

    expect(readLocation(response)).toBe(location)
  },
)

test(`a sign-in that runs out of codes says so`, async () => {
  const { email } = await signInWithApp()
  const first = await startSignIn(email, { code: `000000` })
  const enterAgain = () =>
    enterCode({
      request: new Request(first.clone(), {
        headers: new Headers(first.headers),
      }),
    } as never)
  for (let attempt = 0; attempt < 5; attempt++) {
    await enterAgain()
  }

  const response = await enterAgain()

  expect(readLocation(response)).toBe(`/sign-in?too-many-codes`)
})

/** Runs `send` until it waits for the row, then changes the row's codes */
const replaceCodesDuring = async (
  educatorId: string,
  send: () => Promise<unknown>,
): Promise<unknown> => {
  let sent: Promise<unknown> | undefined
  await prisma.$transaction(async tx => {
    await tx.authenticatorApp.updateMany({
      where: { educatorId },
      data: { backupCodes: `replaced` },
    })
    sent = send()
    await waitForBlockedQuery()
  })
  return sent
}

test(`a recovery code that another sign-in used meanwhile starts sign-in over`, async () => {
  const { educatorId, email, headers } = await signInWithApp()
  const { backupCodes } = await auth.api.viewBackupCodes({
    body: { userId: educatorId },
    headers,
  })
  const first = await startSignIn(email, { code: backupCodes[0]! })
  const second = first.clone()

  const responses = [
    await replaceCodesDuring(educatorId, () =>
      enterRecoveryCode({ request: first } as never),
    ),
    await enterRecoveryCode({ request: second } as never),
  ]

  expect(responses.map(readLocation)).toStrictEqual([
    `/sign-in?challenge-expired`,
    `/sign-in?challenge-expired`,
  ])
})

/** Leaves the app's row, as when turning the app off fails partway */
const turnOffPartway = async (educatorId: string): Promise<void> => {
  await prisma.educator.update({
    where: { id: educatorId },
    data: { twoFactorEnabled: false },
  })
}

test(`setup starts again after turning the app off failed partway`, async () => {
  const admin = await signInWithApp()
  await turnOffPartway(admin.educatorId)

  const reply = await runSignedIn(
    admin,
    setUpApp,
    formPost({ intent: `start`, password: PASSWORD }),
  )

  expect(reply).toMatchObject({ step: `scan` })
})

test(`setup needs the password even after turning the app off failed partway`, async () => {
  const admin = await signInWithApp()
  await turnOffPartway(admin.educatorId)

  const reply = await runSignedIn(
    admin,
    setUpApp,
    formPost({ intent: `start`, password: `wrong` }),
  )

  expect(reply).toMatchObject({ data: { step: `password` } })
  await expect(
    prisma.authenticatorApp.count({ where: { educatorId: admin.educatorId } }),
  ).resolves.toBe(1)
})

test(`a code of an app that's on opens the admin area without its recovery codes`, async () => {
  const admin = await signInAdmin()
  await redeemNewSetupLink(admin)
  const { totpUri, headers } = await turnOnAuthenticatorApp(admin)

  const response = await runSignedIn(
    { ...admin, headers },
    setUpApp,
    formPost({ intent: `turn-on`, totpUri, code: readTotpCode(totpUri) }),
  )

  expect(readLocation(response)).toBe(`/admin`)
})

test(`a code of an app whose turning off failed partway asks to start over`, async () => {
  const admin = await signInAdmin()
  await redeemNewSetupLink(admin)
  const { totpUri, headers } = await turnOnAuthenticatorApp(admin)
  await turnOffPartway(admin.educatorId)

  const reply = await runSignedIn(
    { ...admin, headers },
    setUpApp,
    formPost({ intent: `turn-on`, totpUri, code: readTotpCode(totpUri) }),
  )

  expect(reply).toMatchObject({ data: { step: `password` } })
})

test(`new recovery codes once another tab turned the app off say so`, async () => {
  const admin = await signInWithApp()
  await addPasskey(admin.educatorId)
  const { headers } = await auth.api.disableTwoFactor({
    body: { password: PASSWORD },
    headers: admin.headers,
    returnHeaders: true,
  })

  const reply = await runSignedIn(
    { ...admin, headers: withCookies(headers, randomIp()) },
    changeApp,
    formPost({ intent: `new-codes`, password: PASSWORD }),
  )

  expect(reply).toMatchObject({
    data: {
      result: {
        error: { '': [`Your authenticator app is off. Reload the page`] },
      },
    },
  })
})

test(`starting setup once another tab turned the app on opens the admin area`, async () => {
  const admin = await signInWithApp()

  const response = await runSignedIn(
    admin,
    setUpApp,
    formPost({ intent: `start`, password: PASSWORD }),
  )

  expect(readLocation(response)).toBe(`/admin`)
})

const startSetup = async (admin: SignedIn): Promise<string> => {
  const reply = await runSignedIn(
    admin,
    setUpApp,
    formPost({ intent: `start`, password: PASSWORD }),
  )
  return (reply as { totpUri: string }).totpUri
}

test(`a QR code that another tab's setup replaced asks to start over`, async () => {
  const admin = await signInAdmin()
  await redeemNewSetupLink(admin)
  const earlier = await startSetup(admin)
  await startSetup(admin)

  const reply = await runSignedIn(
    admin,
    setUpApp,
    formPost({
      intent: `turn-on`,
      totpUri: earlier,
      code: readTotpCode(earlier),
    }),
  )

  expect(reply).toMatchObject({ data: { step: `password` } })
})

test(`a wrong code keeps the current QR code`, async () => {
  const admin = await signInAdmin()
  await redeemNewSetupLink(admin)
  const totpUri = await startSetup(admin)
  const wrongCode = readTotpCode(totpUri, Date.now() + 60 * 60 * 1000)

  const reply = await runSignedIn(
    admin,
    setUpApp,
    formPost({ intent: `turn-on`, totpUri, code: wrongCode }),
  )

  expect(reply).toMatchObject({ data: { step: `scan`, totpUri } })
})

test(`setup reports an email over the hourly limit`, async () => {
  const admin = await signInAdmin()
  for (let email = 0; email < 10; email++) {
    await sendEmail(passwordChangedEmail({ to: admin.email }))
  }

  const reply = await runSignedIn(admin, sendSetupLink)

  expect(reply).toStrictEqual({ isSent: false })
})

test(`a used reset link keeps its message while signed in`, async () => {
  const educator = await signInConfirmed()

  const data = await runSignedIn(
    educator,
    forgotPassword,
    new Request(`http://localhost/forgot-password?link-invalid`),
  )

  expect(data).toStrictEqual({ linkInvalid: true, isSignedIn: true })
})

test(`a signed-in educator's reset request for another educator only emails that educator`, async () => {
  const educator = await signInConfirmed()
  const other = await signInConfirmed()
  const readPassword = () =>
    prisma.credential.findFirst({
      where: { educatorId: other.educatorId },
      select: { password: true },
    })
  const before = await readPassword()

  const reply = await runSignedIn(
    educator,
    requestReset,
    formPost({ email: other.email }),
  )

  expect(reply).toStrictEqual({ sentTo: other.email })
  await vi.waitFor(() => {
    expect(
      readMailbox().find(({ text }) => text.includes(`reset-password/`)),
    ).toMatchObject({ to: other.email })
  })
  await expect(readPassword()).resolves.toStrictEqual(before)
})

test(`an account that's signed in isn't shown as deleted`, async () => {
  const educator = await signInConfirmed()

  const response = await runSignedIn(educator, accountDeleted)

  expect(readLocation(response)).toBe(`/contests`)
})

test(`settings offers deletion only to a session that used the second factor`, async () => {
  const admin = await signInAdmin()
  await addPasskey(admin.educatorId)

  const before = await runSignedIn(admin, settings)
  await proveSecondFactor(admin.educatorId)
  const after = await runSignedIn(admin, settings)

  expect([before, after]).toMatchObject([
    { canDelete: false },
    { canDelete: true },
  ])
})

test(`removing a passkey that another tab removed says to reload`, async () => {
  const admin = await signInAdmin()
  await addPasskey(admin.educatorId)
  await proveSecondFactor(admin.educatorId)

  const reply = await runSignedIn(
    admin,
    removePasskeyAction,
    formPost({ id: randomUUID() }),
  )

  expect(reply).toStrictEqual({
    error: `This passkey is gone. Reload the page`,
  })
})

const deleteEducatorAsAdmin = (
  admin: SignedIn,
  educatorId: string,
  email: string,
) => runSignedIn(admin, deleteFromAdmin, formPost({ email }), { educatorId })

test(`an admin who deletes an account gets a notice`, async () => {
  const other = await signInConfirmed()
  const admin = await signInAdmin()

  const response = await deleteEducatorAsAdmin(
    admin,
    other.educatorId,
    other.email,
  )

  expect(readLocation(response)).toBe(`/admin/educators?deleted`)
})

test(`an account that another tab deleted is gone`, async () => {
  const other = await signInConfirmed()
  const admin = await signInAdmin()
  await deleteEducatorAsAdmin(admin, other.educatorId, other.email)

  const reply = await deleteEducatorAsAdmin(
    admin,
    other.educatorId,
    other.email,
  )

  expect(reply).toMatchObject({
    data: {
      result: { error: { '': [`This account is gone. Reload the page`] } },
    },
  })
})

test(`an admin who deletes their own account leaves it`, async () => {
  const admin = await signInAdmin()

  const response = await deleteEducatorAsAdmin(
    admin,
    admin.educatorId,
    admin.email,
  )

  expect(readLocation(response)).toBe(`/account-deleted`)
})
