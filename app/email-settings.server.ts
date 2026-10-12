import { requireEnv } from './env.server.ts'

const TRANSPORTS = [`resend`, `mailbox`] as const
type EmailTransport = (typeof TRANSPORTS)[number]

export const readEmailTransport = (): EmailTransport => {
  const transport = requireEnv(`EMAIL_TRANSPORT`)
  if (!(TRANSPORTS as readonly string[]).includes(transport)) {
    throw new Error(`Set EMAIL_TRANSPORT to one of: ${TRANSPORTS.join(`, `)}`)
  }
  // The mailbox shows every email, sign-in links included, without signing in
  if (transport === `mailbox` && process.env.APP_ENV === `production`) {
    throw new Error(`Set EMAIL_TRANSPORT to resend in production`)
  }
  return transport as EmailTransport
}

// Throws when a setting that sending email needs is missing
export const checkEmailSettings = (): void => {
  requireEnv(`EMAIL_FROM`)
  if (readEmailTransport() === `resend`) {
    requireEnv(`RESEND_API_KEY`)
  }
}
