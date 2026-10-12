import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { auth } from './auth.server.ts'
import { prisma } from './db.server.ts'

test(`sessions don't store the client's IP address`, async () => {
  const credentials = {
    email: `${randomUUID()}@example.com`,
    password: `correct-horse-battery`,
  }
  const { user } = await auth.api.signUpEmail({
    body: { name: `Ada Lovelace`, ...credentials },
  })
  await prisma.educator.update({
    where: { id: user.id },
    data: { emailVerified: true },
  })

  await auth.api.signInEmail({
    body: credentials,
    headers: new Headers({ 'x-forwarded-for': `203.0.113.7` }),
  })

  const sessions = await prisma.session.findMany({
    where: { educatorId: user.id },
  })

  expect(sessions.map(session => session.ipAddress)).toStrictEqual([null])
})
