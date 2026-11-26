import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { auth } from './auth.server.ts'
import { CLIENT_IP_HEADER } from './client-ip.ts'
import { prisma } from './db.server.ts'

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

  expect(sessions.map(session => session.ipAddress)).toStrictEqual([null])
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
