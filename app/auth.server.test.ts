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

test(`wrong current passwords use up an educator's password changes`, async () => {
  const email = `educator-${randomUUID()}@example.com`
  const { user } = await auth.api.signUpEmail({
    body: { name: `Ms. Frizzle`, email, password: `correct-horse-battery` },
    headers: new Headers({ [CLIENT_IP_HEADER]: `203.0.113.99` }),
  })
  await prisma.educator.update({
    where: { id: user.id },
    data: { emailVerified: true },
  })
  const headers = new Headers({ [CLIENT_IP_HEADER]: `203.0.113.99` })
  const signIn = await auth.api.signInEmail({
    body: { email, password: `correct-horse-battery` },
    headers,
    returnHeaders: true,
  })
  headers.set(`cookie`, signIn.headers.getSetCookie()[0]!.split(`;`)[0]!)
  const change = () =>
    auth.api.changePassword({
      body: {
        currentPassword: `wrong-password-1`,
        newPassword: `a-new-password`,
      },
      headers,
    })
  for (let i = 0; i < 10; i++) {
    await expect(change()).rejects.toMatchObject({ statusCode: 400 })
  }

  await expect(change()).rejects.toMatchObject({ statusCode: 429 })
  // Each attempt hashes a password, which is slow in CI
}, 20_000)
