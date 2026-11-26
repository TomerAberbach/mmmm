import { expect, test, vi } from 'vitest'
import {
  addPasskey,
  addSetupLink,
  PASSWORD,
  proveSecondFactor,
  randomIp,
  readSessionId,
  redeemNewSetupLink,
  signInAdmin,
  signInConfirmed,
  signInWithApp,
  turnOnAuthenticatorApp,
  withCookies,
} from '../test/sign-in.ts'
import { readTotpCode } from '../test/totp.ts'
import { auth } from './auth.server.ts'
import { CLIENT_IP_HEADER } from './client-ip.ts'
import { prisma } from './db.server.ts'
import { readMailbox } from './mailbox.server.ts'
import {
  mayChangeSecondFactors,
  mayDeleteAccount,
  readAssurance,
  redeemSetupLink,
  removePasskey,
} from './second-factor.server.ts'

const readAssurances = async (educatorId: string) =>
  (await prisma.session.findMany({ where: { educatorId } })).map(
    ({ assurance }) => assurance,
  )

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

test.each([
  { assurance: `SECOND_FACTOR`, hours: 11, counted: `SECOND_FACTOR` },
  { assurance: `SECOND_FACTOR`, hours: 12, counted: `PASSWORD` },
  { assurance: `SETUP_LINK`, hours: 12, counted: `SETUP_LINK` },
  { assurance: null, hours: 0, counted: `PASSWORD` },
] as const)(
  `a $assurance session that used a second factor $hours hours ago counts as $counted`,
  ({ assurance, hours, counted }) => {
    const secondFactorUsedAt = new Date(Date.now() - hours * 60 * 60 * 1000)

    expect(
      readAssurance({ id: `session-1`, assurance, secondFactorUsedAt }),
    ).toBe(counted)
  },
)

test.each([
  { assurance: `PASSWORD`, hasAuthenticatorApp: false, mayDelete: true },
  { assurance: `PASSWORD`, hasAuthenticatorApp: true, mayDelete: false },
  { assurance: `SETUP_LINK`, hasAuthenticatorApp: true, mayDelete: false },
  { assurance: `SECOND_FACTOR`, hasAuthenticatorApp: true, mayDelete: true },
] as const)(
  `a $assurance session, with an authenticator app: $hasAuthenticatorApp, may delete the account: $mayDelete`,
  ({ assurance, hasAuthenticatorApp, mayDelete }) => {
    const secondFactors = { passkeys: [], hasAuthenticatorApp }

    expect(mayDeleteAccount(assurance, secondFactors)).toBe(mayDelete)
  },
)

test(`a password alone can't add an admin's first second factor`, async () => {
  const admin = await signInAdmin()

  const enabling = auth.api.enableTwoFactor({
    body: { password: PASSWORD },
    headers: admin.headers,
  })

  await expect(enabling).rejects.toMatchObject({
    body: { message: `Use your second factor before changing it` },
  })
})

test(`educators off the admin list can't add a second factor`, async () => {
  const educator = await signInConfirmed()
  await redeemNewSetupLink(educator)

  const enabling = auth.api.enableTwoFactor({
    body: { password: PASSWORD },
    headers: educator.headers,
  })

  await expect(enabling).rejects.toMatchObject({
    body: { message: `Only admins add second factors` },
  })
})

test(`turning on an authenticator app after a setup link counts as using it`, async () => {
  const admin = await signInAdmin()
  await redeemNewSetupLink(admin)

  await turnOnAuthenticatorApp(admin)

  await expect(readAssurances(admin.educatorId)).resolves.toStrictEqual([
    `SECOND_FACTOR`,
  ])
})

test(`signing in with an authenticator app's code uses a second factor`, async () => {
  const admin = await signInAdmin()
  await redeemNewSetupLink(admin)
  const { totpUri } = await turnOnAuthenticatorApp(admin)
  await prisma.session.deleteMany({ where: { educatorId: admin.educatorId } })
  const ip = randomIp()
  const { headers: challenge } = await auth.api.signInEmail({
    body: { email: admin.email, password: PASSWORD },
    headers: new Headers({ [CLIENT_IP_HEADER]: ip }),
    returnHeaders: true,
  })

  const { headers } = await auth.api.verifyTOTP({
    body: { code: readTotpCode(totpUri) },
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
  await redeemNewSetupLink(admin)
  const { headers } = await turnOnAuthenticatorApp(admin)

  const disabling = auth.api.disableTwoFactor({
    body: { password: PASSWORD },
    headers,
  })

  await expect(disabling).rejects.toMatchObject({
    body: {
      message: `Admins keep at least one second factor. Add another before removing this one`,
    },
  })
})

test(`a former admin removes their last second factor`, async () => {
  const admin = await signInAdmin()
  await redeemNewSetupLink(admin)
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
  const token = await addSetupLink(educatorId)

  const redeemed = [
    await redeemSetupLink(token, educatorId, await readSessionId(educatorId)),
    await redeemSetupLink(token, educatorId, await readSessionId(educatorId)),
  ]

  expect(redeemed).toStrictEqual([true, false])
})

test(`a setup link works only for its own educator`, async () => {
  const owner = await signInConfirmed()
  const other = await signInConfirmed()
  const token = await addSetupLink(owner.educatorId)

  const redeemed = await redeemSetupLink(
    token,
    other.educatorId,
    await readSessionId(other.educatorId),
  )

  expect(redeemed).toBe(false)
})

test(`a new setup link replaces the educator's earlier one`, async () => {
  const { educatorId } = await signInConfirmed()
  const earlier = await addSetupLink(educatorId)
  await addSetupLink(educatorId)

  const redeemed = await redeemSetupLink(
    earlier,
    educatorId,
    await readSessionId(educatorId),
  )

  expect(redeemed).toBe(false)
})

test(`a setup link expires after an hour`, async () => {
  const { educatorId } = await signInConfirmed()
  const token = await addSetupLink(educatorId)
  vi.useFakeTimers({ now: Date.now() + 61 * 60 * 1000, toFake: [`Date`] })

  const redeemed = await redeemSetupLink(
    token,
    educatorId,
    await readSessionId(educatorId),
  )

  expect(redeemed).toBe(false)
})

test(`a setup link works in a session whose second factor was used too long ago`, async () => {
  const admin = await signInAdmin()
  const { id: sessionId } = await prisma.session.findFirstOrThrow({
    where: { educatorId: admin.educatorId },
  })
  await prisma.session.update({
    where: { id: sessionId },
    data: { assurance: `SECOND_FACTOR`, secondFactorUsedAt: new Date(0) },
  })
  const token = await addSetupLink(admin.educatorId)

  await redeemSetupLink(token, admin.educatorId, sessionId)

  await expect(readAssurances(admin.educatorId)).resolves.toStrictEqual([
    `SETUP_LINK`,
  ])
})

test.each([
  {
    proof: `a password`,
    before: { assurance: `PASSWORD`, secondFactorUsedAt: null },
  },
  {
    proof: `a setup link`,
    before: { assurance: `SETUP_LINK`, secondFactorUsedAt: null },
  },
  {
    proof: `a second factor`,
    before: {
      assurance: `SECOND_FACTOR`,
      secondFactorUsedAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  },
] as const)(
  `changing the password keeps $proof as what the session proved, and signs out the others`,
  async ({ before }) => {
    const { educatorId, email, headers } = await signInConfirmed()
    await prisma.session.updateMany({ where: { educatorId }, data: before })
    await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      headers: new Headers({ [CLIENT_IP_HEADER]: randomIp() }),
    })

    await auth.api.changePassword({
      body: { currentPassword: PASSWORD, newPassword: `${PASSWORD}-2` },
      headers,
    })

    await expect(
      prisma.session.findMany({
        where: { educatorId },
        select: { assurance: true, secondFactorUsedAt: true },
      }),
    ).resolves.toStrictEqual([before])
  },
)

test(`a password session that changes the password leaves the other session's second factor behind`, async () => {
  const { educatorId, email, headers } = await signInConfirmed()
  await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: new Headers({ [CLIENT_IP_HEADER]: randomIp() }),
  })
  await proveSecondFactor(educatorId)
  const { id: ownId } = await prisma.session.findFirstOrThrow({
    where: { educatorId },
    orderBy: { createdAt: `asc` },
  })
  await prisma.session.update({
    where: { id: ownId },
    data: { assurance: `PASSWORD`, secondFactorUsedAt: null },
  })

  await auth.api.changePassword({
    body: { currentPassword: PASSWORD, newPassword: `${PASSWORD}-2` },
    headers,
  })

  await expect(readAssurances(educatorId)).resolves.toStrictEqual([`PASSWORD`])
})

const guessPassword = (headers: Headers, guess: string) =>
  auth.api.generateBackupCodes({ body: { password: guess }, headers })

test(`a session that guesses its password 10 times can't try again with any password prompt`, async () => {
  const { headers } = await signInWithApp()
  for (let guess = 0; guess < 10; guess++) {
    await expect(guessPassword(headers, `wrong`)).rejects.toMatchObject({
      body: { code: `INVALID_PASSWORD` },
    })
  }

  const replies = await Promise.allSettled([
    guessPassword(headers, PASSWORD),
    auth.api.disableTwoFactor({ body: { password: PASSWORD }, headers }),
    auth.api.enableTwoFactor({ body: { password: PASSWORD }, headers }),
    auth.api.changePassword({
      body: { currentPassword: PASSWORD, newPassword: `${PASSWORD}-2` },
      headers,
    }),
  ])

  expect(replies).toMatchObject(
    Array.from({ length: 4 }, () => ({ reason: { statusCode: 429 } })),
  )
})

test(`one educator's wrong passwords leave another at the same IP address their own attempts`, async () => {
  const { headers } = await signInWithApp()
  const other = await signInWithApp()
  other.headers.set(CLIENT_IP_HEADER, headers.get(CLIENT_IP_HEADER)!)
  vi.stubEnv(`ADMIN_LIST`, ``)
  for (let guess = 0; guess < 10; guess++) {
    await guessPassword(headers, `wrong`).catch(() => undefined)
  }

  const reply = guessPassword(other.headers, PASSWORD)

  await expect(reply).resolves.toHaveProperty(`backupCodes`)
})

test(`right passwords use up no attempts`, async () => {
  const { headers } = await signInWithApp()
  for (let prompt = 0; prompt < 10; prompt++) {
    await guessPassword(headers, PASSWORD)
  }

  const next = guessPassword(headers, PASSWORD)

  await expect(next).resolves.toHaveProperty(`backupCodes`)
})

test.each([
  {
    failure: `an app that's already on`,
    prompt: (password: string, headers: Headers) =>
      auth.api.enableTwoFactor({ body: { password }, headers }),
  },
  {
    failure: `an admin's last second factor`,
    prompt: (password: string, headers: Headers) =>
      auth.api.disableTwoFactor({ body: { password }, headers }),
  },
])(
  `right passwords refused for $failure never use up the attempts`,
  async ({ prompt }) => {
    const { headers } = await signInWithApp()
    for (let attempt = 0; attempt < 10; attempt++) {
      await expect(prompt(PASSWORD, headers)).rejects.toMatchObject({
        statusCode: 400,
      })
    }

    const next = guessPassword(headers, PASSWORD)

    await expect(next).resolves.toHaveProperty(`backupCodes`)
  },
)

test(`refusals give a session that guesses its password no extra attempts`, async () => {
  const { educatorId, headers } = await signInWithApp()
  const refuseAnother = async () => {
    await prisma.session.updateMany({
      where: { educatorId },
      data: { assurance: `PASSWORD` },
    })
    await expect(guessPassword(headers, PASSWORD)).rejects.toMatchObject({
      statusCode: 403,
    })
    await proveSecondFactor(educatorId)
  }
  for (let guess = 0; guess < 10; guess++) {
    await expect(guessPassword(headers, `wrong`)).rejects.toMatchObject({
      body: { code: `INVALID_PASSWORD` },
    })
    await refuseAnother()
  }

  const next = guessPassword(headers, PASSWORD)

  await expect(next).rejects.toMatchObject({ statusCode: 429 })
})

const countSecondFactors = async (educatorId: string): Promise<number> => {
  const educator = await prisma.educator.findUniqueOrThrow({
    where: { id: educatorId },
    include: { passkeys: true },
  })
  return educator.passkeys.length + Number(educator.twoFactorEnabled)
}

test(
  `removing an admin's 2 passkeys at once keeps one`,
  { repeats: 9 },
  async () => {
    const { educatorId } = await signInAdmin()
    const ids = [await addPasskey(educatorId), await addPasskey(educatorId)]

    const removals = await Promise.allSettled(
      ids.map(id => removePasskey(id, educatorId, `SECOND_FACTOR`)),
    )

    expect(removals.map(({ status }) => status).toSorted()).toStrictEqual([
      `fulfilled`,
      `rejected`,
    ])
    await expect(countSecondFactors(educatorId)).resolves.toBe(1)
  },
)

test(
  `removing an admin's passkey and authenticator app at once keeps one`,
  { repeats: 9 },
  async () => {
    const { educatorId, headers } = await signInWithApp()
    const passkeyId = await addPasskey(educatorId)

    const removals = await Promise.allSettled([
      removePasskey(passkeyId, educatorId, `SECOND_FACTOR`),
      auth.api.disableTwoFactor({ body: { password: PASSWORD }, headers }),
    ])

    expect(removals.map(({ status }) => status).toSorted()).toStrictEqual([
      `fulfilled`,
      `rejected`,
    ])
    await expect(countSecondFactors(educatorId)).resolves.toBe(1)
  },
)

test(`an admin with another second factor turns the authenticator app off`, async () => {
  const { educatorId, headers } = await signInWithApp()
  await addPasskey(educatorId)

  await auth.api.disableTwoFactor({ body: { password: PASSWORD }, headers })

  await expect(countSecondFactors(educatorId)).resolves.toBe(1)
})

test(`removing a passkey emails the educator`, async () => {
  const { educatorId, email } = await signInAdmin()
  const id = await addPasskey(educatorId)
  await addPasskey(educatorId)

  await removePasskey(id, educatorId, `SECOND_FACTOR`)

  await vi.waitFor(() => {
    expect(readMailbox()[0]).toMatchObject({
      to: email,
      text: expect.stringContaining(`passkey`) as string,
    })
  })
})

test(`a session that used no second factor can't remove a passkey`, async () => {
  const { educatorId } = await signInAdmin()
  const id = await addPasskey(educatorId)
  await addPasskey(educatorId)

  const removing = removePasskey(id, educatorId, `PASSWORD`)

  await expect(removing).rejects.toMatchObject({
    body: { message: `Use your second factor before changing it` },
  })
})

test(`another educator's passkey isn't found`, async () => {
  const other = await signInConfirmed()
  const id = await addPasskey(other.educatorId)
  const { educatorId } = await signInAdmin()
  await addPasskey(educatorId)

  const isRemoved = await removePasskey(id, educatorId, `SECOND_FACTOR`)

  expect(isRemoved).toBe(false)
  await expect(countSecondFactors(other.educatorId)).resolves.toBe(1)
})
