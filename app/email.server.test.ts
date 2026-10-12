import { randomUUID } from 'node:crypto'
import { expect, test, vi } from 'vitest'
import { sendEmail } from './email.server.ts'
import { confirmEmail } from './emails/confirm-email.server.tsx'
import { readMailbox } from './mailbox.server.ts'

const anEmail = (to: string) =>
  confirmEmail({ to, url: `http://localhost:3000/confirm` })

test(`the mailbox keeps the email as HTML and plain text`, async () => {
  const to = `${randomUUID()}@example.com`

  await sendEmail(anEmail(to))

  const email = readMailbox().find(sent => sent.to === to)
  expect(email).toMatchObject({
    from: `MMMM <noreply@example.com>`,
    subject: `Confirm your email address for MMMM`,
  })
  expect(email?.html).toContain(`<html`)
  expect(email?.text).toContain(
    `Confirm email address:\nhttp://localhost:3000/confirm`,
  )
})

test(`Resend receives the email with its idempotency key`, async () => {
  vi.stubEnv(`EMAIL_TRANSPORT`, `resend`)
  vi.stubEnv(`RESEND_API_KEY`, `re_test`)
  const resend = vi.fn<typeof fetch>().mockResolvedValue(new Response(`{}`))
  vi.stubGlobal(`fetch`, resend)

  await sendEmail({
    ...anEmail(`ada@example.com`),
    idempotencyKey: `confirm-1`,
  })

  const [url, init] = resend.mock.calls[0] ?? []
  expect(url).toBe(`https://api.resend.com/emails`)
  expect(init?.headers).toMatchObject({
    Authorization: `Bearer re_test`,
    'Idempotency-Key': `confirm-1`,
  })
  expect(JSON.parse(init?.body as string)).toMatchObject({
    to: `ada@example.com`,
    subject: `Confirm your email address for MMMM`,
  })
})

test(`an email Resend rejects throws with Resend's reason`, async () => {
  vi.stubEnv(`EMAIL_TRANSPORT`, `resend`)
  vi.stubEnv(`RESEND_API_KEY`, `re_test`)
  vi.stubGlobal(
    `fetch`,
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(`invalid from`, { status: 422 })),
  )

  const sending = sendEmail(anEmail(`ada@example.com`))

  await expect(sending).rejects.toThrow(
    `Resend rejected the email with 422: invalid from`,
  )
})

test(`every theme class in an email resolves to an inline style`, async () => {
  const to = `${randomUUID()}@example.com`

  await sendEmail(anEmail(to))

  const email = readMailbox().find(sent => sent.to === to)
  expect(email?.html).not.toMatch(/class="[^"]*\b(?:text|bg|border)-/u)
})
