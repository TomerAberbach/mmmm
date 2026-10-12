import { render, toPlainText } from '@react-email/render'
import type { FormatCallback } from 'html-to-text'
import type { ReactElement } from 'react'
import { readEmailTransport } from './email-settings.server.ts'
import { requireEnv } from './env.server.ts'
import { saveToMailbox } from './mailbox.server.ts'
import type { RenderedEmail } from './mailbox.server.ts'

type Email = {
  to: string
  subject: string
  body: ReactElement
  // Resend sends an email once per key, so a retried request can't send twice
  idempotencyKey?: string
}

export const sendEmail = async ({
  idempotencyKey,
  ...email
}: Email): Promise<void> => {
  const rendered = await renderEmail(email)
  if (readEmailTransport() === `mailbox`) {
    saveToMailbox(rendered)
    return
  }
  await sendWithResend(rendered, idempotencyKey)
}

const renderEmail = async ({
  to,
  subject,
  body,
}: Omit<Email, `idempotencyKey`>): Promise<RenderedEmail> => {
  const html = await render(body)
  return {
    from: requireEnv(`EMAIL_FROM`),
    to,
    subject,
    html,
    text: toPlainText(html, PLAIN_TEXT_OPTIONS),
  }
}

// Prints an EmailAction's label with its link on the next line
const formatEmailAction: FormatCallback = (element, walk, builder) => {
  builder.openBlock({ leadingLineBreaks: 2 })
  walk(element.children, builder)
  builder.addInline(`:`)
  builder.addLineBreak()
  const { href = `` } = element.attribs as { href?: string }
  builder.addInline(href, { noWordTransform: true })
  builder.closeBlock({ trailingLineBreaks: 2 })
}

// `toPlainText` adds React Email's own selectors before these
const PLAIN_TEXT_OPTIONS = {
  selectors: [
    { selector: `a[data-action]`, format: `emailAction` },
    { selector: `h1`, options: { uppercase: false } },
  ],
  formatters: { emailAction: formatEmailAction },
} satisfies Parameters<typeof toPlainText>[1]

const RESEND_TIMEOUT_MS = 10_000

const sendWithResend = async (
  email: RenderedEmail,
  idempotencyKey: string | undefined,
): Promise<void> => {
  const response = await fetch(`https://api.resend.com/emails`, {
    method: `POST`,
    headers: {
      Authorization: `Bearer ${requireEnv(`RESEND_API_KEY`)}`,
      'Content-Type': `application/json`,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(email),
    signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(
      `Resend rejected the email with ${response.status}: ${await response.text()}`,
    )
  }
}
