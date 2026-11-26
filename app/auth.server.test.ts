import { randomUUID } from 'node:crypto'
import { expect, test, vi } from 'vitest'
import { auth } from './auth.server.ts'
import { CLIENT_IP_HEADER } from './client-ip.ts'
import { prisma } from './db.server.ts'
import { readMailbox } from './mailbox.server.ts'
import { readOrganization } from './organizations.server.ts'

test(`sessions don't store the client's IP address`, async () => {
  const credentials = {
    email: `${randomUUID()}@example.com`,
    password: `correct-horse-battery`,
  }
  const headers = new Headers({
    'x-forwarded-for': `203.0.113.7`,
    [CLIENT_IP_HEADER]: `203.0.113.7`,
  })
  const { user } = await auth.api.signUpEmail({
    body: { name: `Ada Lovelace`, ...credentials },
    headers,
  })
  await prisma.educator.update({
    where: { id: user.id },
    data: { emailVerified: true },
  })

  await auth.api.signInEmail({
    body: credentials,
    headers,
  })

  const sessions = await prisma.session.findMany({
    where: { educatorId: user.id },
  })

  expect(
    sessions.map(({ ipAddress, userAgent }) => ({ ipAddress, userAgent })),
  ).toStrictEqual([{ ipAddress: null, userAgent: null }])
})

test.each<[string, object, string]>([
  [
    `a short password`,
    { password: `short` },
    `Enter a password of at least 10 characters`,
  ],
  [`an unexpected field`, { image: 1 }, `Unrecognized key`],
])(
  `a sign-up refused for %s keeps the address's unconfirmed educator`,
  async (_, invalid, message) => {
    const email = `${randomUUID()}@example.com`
    const body = {
      name: `Ada Lovelace`,
      email,
      password: `correct-horse-battery`,
    }
    const headers = new Headers({ [CLIENT_IP_HEADER]: `203.0.113.8` })
    const { user } = await auth.api.signUpEmail({ body, headers })

    const refused = auth.api.signUpEmail({
      body: { ...body, ...invalid },
      headers,
    })

    await expect(refused).rejects.toThrow(message)
    await expect(
      prisma.educator.findUniqueOrThrow({ where: { email } }),
    ).resolves.toMatchObject({ id: user.id })
  },
)

test(`a sign-up in other letter case replaces the address's unconfirmed educator`, async () => {
  const email = `${randomUUID()}@example.com`
  const body = { name: `Ada Lovelace`, password: `correct-horse-battery` }
  const headers = new Headers({ [CLIENT_IP_HEADER]: `203.0.113.10` })
  const first = await auth.api.signUpEmail({
    body: { ...body, email },
    headers,
  })

  await auth.api.signUpEmail({
    body: { ...body, email: email.toUpperCase() },
    headers,
  })

  const educator = await prisma.educator.findUniqueOrThrow({ where: { email } })
  expect(educator.id).not.toBe(first.user.id)
})

test(`an educator who confirmed with a reset link joins their organization at sign-in`, async () => {
  const domain = `${randomUUID()}.edu`
  const email = `frizzle@${domain}`
  const newPassword = `wahoo-magic-school-bus`
  const headers = new Headers({ [CLIENT_IP_HEADER]: `203.0.113.9` })
  const { user } = await auth.api.signUpEmail({
    body: { name: `Ms. Frizzle`, email, password: `correct-horse-battery` },
    headers,
  })
  await auth.api.requestPasswordReset({ body: { email }, headers })
  const token = await vi.waitFor(() => {
    const text = readMailbox()
      .filter(sent => sent.to === email)
      .map(sent => sent.text)
      .join(`\n`)
    return /\/reset-password\/(?<token>[^?\s]+)/u.exec(text)!.groups!.token!
  })

  await auth.api.resetPassword({
    body: { token, newPassword },
    headers,
  })

  await auth.api.signInEmail({
    body: { email, password: newPassword },
    headers,
  })

  await expect(readOrganization(user.id)).resolves.toStrictEqual({
    domain,
    name: null,
  })
})
