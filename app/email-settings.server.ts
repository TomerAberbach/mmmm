import { z } from 'zod'
import { readAppEnv, requireEnv } from './env.server.ts'
import type { AppEnv } from './env.server.ts'

const TRANSPORTS = [`resend`, `mailbox`] as const
type EmailTransport = (typeof TRANSPORTS)[number]

// The mailbox shows every email, confirmation links included, without signing
// in, so only development and tests may use it
const MAILBOX_APP_ENVS: ReadonlySet<AppEnv> = new Set([`development`, `test`])

export const readEmailTransport = (): EmailTransport => {
  const transport = z.enum(TRANSPORTS).safeParse(requireEnv(`EMAIL_TRANSPORT`))
  if (!transport.success) {
    throw new Error(`Set EMAIL_TRANSPORT to one of: ${TRANSPORTS.join(`, `)}`)
  }
  if (transport.data === `mailbox` && !MAILBOX_APP_ENVS.has(readAppEnv())) {
    throw new Error(
      `Set EMAIL_TRANSPORT to resend outside development and tests`,
    )
  }
  return transport.data
}

// Throws when a setting that sending email needs is missing
export const checkEmailSettings = (): void => {
  requireEnv(`EMAIL_FROM`)
  if (readEmailTransport() === `resend`) {
    requireEnv(`RESEND_API_KEY`)
  }
}
