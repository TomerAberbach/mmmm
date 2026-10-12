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

test.each([`staging`, `production`])(
  `APP_ENV %s refuses the mailbox`,
  appEnv => {
    vi.stubEnv(`APP_ENV`, appEnv)

    expect(readEmailTransport).toThrow(
      `Set EMAIL_TRANSPORT to resend outside development and tests`,
    )
  },
)

test.each([`development`, `test`])(`APP_ENV %s allows the mailbox`, appEnv => {
  vi.stubEnv(`APP_ENV`, appEnv)

  expect(readEmailTransport()).toBe(`mailbox`)
})

test(`an unknown APP_ENV fails with the allowed ones`, () => {
  vi.stubEnv(`APP_ENV`, `prod`)

  expect(readEmailTransport).toThrow(
    `Set APP_ENV to one of: development, test, staging, production`,
  )
})

test(`sending through Resend needs an API key from startup`, () => {
  vi.stubEnv(`EMAIL_TRANSPORT`, `resend`)
  vi.stubEnv(`RESEND_API_KEY`, ``)

  expect(checkEmailSettings).toThrow(`Set RESEND_API_KEY`)
})
