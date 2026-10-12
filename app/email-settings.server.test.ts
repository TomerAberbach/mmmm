import { expect, test, vi } from 'vitest'
import {
  checkEmailSettings,
  readEmailTransport,
} from './email-settings.server.ts'

test(`an unknown transport fails with the allowed ones`, () => {
  vi.stubEnv(`EMAIL_TRANSPORT`, `smtp`)

  expect(readEmailTransport).toThrow(
    `Set EMAIL_TRANSPORT to one of: resend, mailbox`,
  )
})

test(`production refuses the mailbox`, () => {
  vi.stubEnv(`APP_ENV`, `production`)

  expect(readEmailTransport).toThrow(
    `Set EMAIL_TRANSPORT to resend in production`,
  )
})

test(`sending through Resend needs an API key from startup`, () => {
  vi.stubEnv(`EMAIL_TRANSPORT`, `resend`)
  vi.stubEnv(`RESEND_API_KEY`, ``)

  expect(checkEmailSettings).toThrow(`Set RESEND_API_KEY`)
})
