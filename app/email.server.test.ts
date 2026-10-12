import { randomUUID } from 'node:crypto'
import { expect, test, vi } from 'vitest'
import { sendEmail, sendNoticeOrLog } from './email.server.ts'
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

test(`Resend receives the email with the API key`, async () => {
  vi.stubEnv(`EMAIL_TRANSPORT`, `resend`)
  vi.stubEnv(`RESEND_API_KEY`, `re_test`)
  const resend = vi.fn<typeof fetch>().mockResolvedValue(new Response(`{}`))
  vi.stubGlobal(`fetch`, resend)

  await sendEmail(anEmail(`ada@example.com`))

  const [url, init] = resend.mock.calls[0] ?? []
  expect(url).toBe(`https://api.resend.com/emails`)
  expect(init?.headers).toMatchObject({
    Authorization: `Bearer re_test`,
  })
  expect(JSON.parse(init?.body as string)).toMatchObject({
    to: `ada@example.com`,
    subject: `Confirm your email address for MMMM`,
  })
})

test(`an email Resend rejects throws with Resend's error name, not its message`, async () => {
  vi.stubEnv(`EMAIL_TRANSPORT`, `resend`)
  vi.stubEnv(`RESEND_API_KEY`, `re_test`)
  const rejection = Response.json(
    {
      name: `validation_error`,
      message: `Invalid \`to\` field: ada@example.com`,
    },
    { status: 422 },
  )
  vi.stubGlobal(`fetch`, vi.fn<typeof fetch>().mockResolvedValue(rejection))

  const sending = sendEmail(anEmail(`ada@example.com`))

  await expect(sending).rejects.toThrow(
    /^Resend rejected the email with 422: validation_error$/u,
  )
})

test(`every theme class in an email resolves to an inline style`, async () => {
  const to = `${randomUUID()}@example.com`

  await sendEmail(anEmail(to))

  const email = readMailbox().find(sent => sent.to === to)
  expect(email?.html).not.toMatch(/class="[^"]*\b(?:text|bg|border)-/u)
})

test(`an address gets 10 emails an hour, and the rest are skipped`, async () => {
  const to = `${randomUUID()}@example.com`
  vi.spyOn(console, `warn`).mockReturnValue(undefined)

  for (let sent = 0; sent < 11; sent++) {
    await sendEmail(anEmail(sent === 10 ? to.toUpperCase() : to))
  }

  expect(
    readMailbox().filter(email => email.to.toLowerCase() === to),
  ).toHaveLength(10)
})

test(`a security notice arrives even once the address's share is used up`, async () => {
  const to = `${randomUUID()}@example.com`
  vi.spyOn(console, `warn`).mockReturnValue(undefined)
  for (let sent = 0; sent < 10; sent++) {
    await sendEmail(anEmail(to))
  }

  await sendNoticeOrLog(anEmail(to))

  expect(readMailbox().filter(email => email.to === to)).toHaveLength(11)
})
