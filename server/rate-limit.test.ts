import { expect, test } from 'vitest'
import { serve } from '../test/http.ts'
import { limitRequestsPerIp } from './rate-limit.ts'

test(`requests over the limit get a 429 with Retry-After`, async () => {
  const url = await serve(limitRequestsPerIp(1))
  await fetch(url)

  const response = await fetch(url)

  expect(response.status).toBe(429)
  expect(response.headers.get(`retry-after`)).toBe(`60`)
})
