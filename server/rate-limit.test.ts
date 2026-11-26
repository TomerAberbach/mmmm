import { expect, test } from 'vitest'
import { serve } from '../test/http.ts'
import { limitFailedLoginsPerIp, limitRequestsPerIp } from './rate-limit.ts'
import { requireStagingPassword } from './staging-password.ts'

test(`requests over the limit get a 429 with Retry-After`, async () => {
  const url = await serve(limitRequestsPerIp(1))
  await fetch(url)

  const response = await fetch(url)

  expect(response.status).toBe(429)
  expect(response.headers.get(`retry-after`)).toBe(`60`)
})

test(`wrong staging passwords are limited, and right ones aren't`, async () => {
  const url = await serve(
    limitFailedLoginsPerIp(2),
    requireStagingPassword(`secret`),
  )
  const request = async (password: string) => {
    const authorization = `Basic ${btoa(`tester:${password}`)}`
    return (await fetch(url, { headers: { authorization } })).status
  }

  const statuses = await Array.fromAsync(
    [`secret`, `secret`, `secret`, `a`, `b`, `c`],
    request,
  )

  expect(statuses).toStrictEqual([200, 200, 200, 401, 401, 429])
})
