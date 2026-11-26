import { randomUUID } from 'node:crypto'
import { expect, test, vi } from 'vitest'
import { auth } from '../app/auth.server.ts'
import { CLIENT_IP_HEADER } from '../app/client-ip.ts'
import { prisma } from '../app/db.server.ts'
import { readMailbox } from '../app/mailbox.server.ts'
import { countWaiting, sendLaunchEmails } from './launch-emails.ts'

const addImported = async (createdAt = new Date()) => {
  const id = randomUUID()
  const email = `${id}@${randomUUID()}.edu`
  await prisma.educator.create({
    data: { id, name: `Educator`, email, createdAt },
  })
  return { id, email }
}

const isEmailed = (email: string) =>
  readMailbox().some(
    ({ to, subject }) =>
      to === email && subject === `Set your password for the new MMMM`,
  )

const readToken = (email: string): string => {
  const { html } = readMailbox().find(({ to }) => to === email)!
  return /reset-password\/(?<token>[\w-]+)\?callbackURL=%2Freset-password/u.exec(
    html,
  )!.groups!.token!
}

const send = (limit = 1000) => sendLaunchEmails({ limit, pauseMs: 0 })

/** Makes Resend reject every email to the address */
const rejectEmailsTo = (rejected: string) => {
  vi.stubEnv(`EMAIL_TRANSPORT`, `resend`)
  vi.stubEnv(`RESEND_API_KEY`, `key`)
  vi.stubGlobal(`fetch`, (_url: string, { body }: { body: string }) => {
    const { to } = JSON.parse(body) as { to: string }
    return Promise.resolve(
      Response.json(
        { name: `validation_error` },
        { status: to === rejected ? 422 : 200 },
      ),
    )
  })
}

test(`the launch email's link sets a password and confirms the address`, async () => {
  const { id, email } = await addImported()

  await send()
  const headers = new Headers({ [CLIENT_IP_HEADER]: `203.0.113.7` })
  await auth.api.resetPassword({
    body: { token: readToken(email), newPassword: `a long new password` },
    headers,
  })
  const { user } = await auth.api.signInEmail({
    body: { email, password: `a long new password` },
    headers,
  })

  expect(user).toMatchObject({ id, emailVerified: true })
  await expect(
    prisma.educator.findUnique({
      where: { id },
      select: { organizationDomain: true },
    }),
  ).resolves.toStrictEqual({ organizationDomain: email.split(`@`)[1] })
})

test(`each educator gets one launch email`, async () => {
  const { email } = await addImported()
  await send()

  await expect(send()).resolves.toMatchObject({ sent: 0 })

  expect(readMailbox().filter(({ to }) => to === email)).toHaveLength(1)
})

test(`a run stops at its limit, oldest first`, async () => {
  await send()
  const newer = await addImported(new Date(`2023-01-01T00:00:00Z`))
  const older = await addImported(new Date(`2022-01-01T00:00:00Z`))

  await expect(send(1)).resolves.toMatchObject({ sent: 1 })

  expect(isEmailed(older.email)).toBe(true)
  expect(isEmailed(newer.email)).toBe(false)
  await expect(countWaiting()).resolves.toBe(1)
})

test(`an interrupted run stops after the current educator`, async () => {
  await send()
  const first = await addImported(new Date(`2022-01-01T00:00:00Z`))
  const second = await addImported(new Date(`2023-01-01T00:00:00Z`))
  const stop = new AbortController()

  const run = sendLaunchEmails({
    limit: 1000,
    pauseMs: 500,
    signal: stop.signal,
  })
  await expect.poll(() => isEmailed(first.email)).toBe(true)
  stop.abort()

  await expect(run).resolves.toMatchObject({ sent: 1 })
  expect(isEmailed(second.email)).toBe(false)
  await expect(countWaiting()).resolves.toBe(1)
})

test(`an educator who signed up gets no launch email`, async () => {
  const unconfirmed = await addImported()
  await prisma.credential.create({
    data: {
      id: randomUUID(),
      accountId: unconfirmed.id,
      providerId: `credential`,
      educatorId: unconfirmed.id,
      password: `hash`,
    },
  })
  const confirmed = await addImported()
  await prisma.educator.update({
    where: { id: confirmed.id },
    data: { emailVerified: true },
  })

  await send()

  expect(isEmailed(unconfirmed.email)).toBe(false)
  expect(isEmailed(confirmed.email)).toBe(false)
})

test(`a rejected address keeps waiting while later educators are emailed`, async () => {
  await send()
  const rejected = await addImported(new Date(`2022-01-01T00:00:00Z`))
  const later = await addImported(new Date(`2023-01-01T00:00:00Z`))
  rejectEmailsTo(rejected.email)

  const run = await send()

  expect(run).toMatchObject({
    sent: 1,
    failures: [{ educatorId: rejected.id }],
  })
  await expect(
    prisma.educator.findMany({
      where: {
        id: { in: [rejected.id, later.id] },
        launchEmailedAt: { not: null },
      },
      select: { id: true },
    }),
  ).resolves.toStrictEqual([{ id: later.id }])
})

test(`a password reset turns off earlier links`, async () => {
  const { id, email } = await addImported()
  await send()
  await prisma.verification.create({
    data: {
      id: randomUUID(),
      identifier: `reset-password:${randomUUID()}`,
      value: id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  })

  await auth.api.resetPassword({
    body: { token: readToken(email), newPassword: `a long new password` },
    headers: new Headers({ [CLIENT_IP_HEADER]: `203.0.113.8` }),
  })

  await expect(
    prisma.verification.count({ where: { value: id } }),
  ).resolves.toBe(0)
})
