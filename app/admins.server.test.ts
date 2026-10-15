import { expect, test, vi } from 'vitest'
import { isAdmin } from './admins.server.ts'

test.each([
  {
    scenario: `a confirmed address on the list`,
    educator: { email: `ms.frizzle@example.com`, emailVerified: true },
    expected: true,
  },
  {
    scenario: `an address on the list in another case`,
    educator: { email: `Ms.Frizzle@Example.com`, emailVerified: true },
    expected: true,
  },
  {
    scenario: `an unconfirmed address on the list`,
    educator: { email: `ms.frizzle@example.com`, emailVerified: false },
    expected: false,
  },
  {
    scenario: `a confirmed address off the list`,
    educator: { email: `mr.wizard@example.com`, emailVerified: true },
    expected: false,
  },
])(`$scenario is an admin: $expected`, ({ educator, expected }) => {
  vi.stubEnv(`ADMIN_LIST`, ` ms.frizzle@example.com , liz@example.com`)

  expect(isAdmin(educator)).toBe(expected)
})

test(`without an admin list, nobody is an admin`, () => {
  vi.stubEnv(`ADMIN_LIST`, ``)

  const admin = isAdmin({ email: ``, emailVerified: true })

  expect(admin).toBe(false)
})
