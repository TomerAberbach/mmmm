import { expect, test, vi } from 'vitest'
import { serve } from '../test/http.ts'
import { logRequests, redactPath } from './logging.ts'

test.each([
  { path: `/contests/123`, redacted: `/contests/123` },
  {
    path: `/api/auth/reset-password/secret`,
    redacted: `/api/auth/reset-password/[redacted]`,
  },
  {
    path: `//api/auth/reset-password/secret`,
    redacted: `//api/auth/reset-password/[redacted]`,
  },
])(`logs $path as $redacted`, ({ path, redacted }) => {
  expect(redactPath(path)).toBe(redacted)
})

test(`requests are logged without query strings or health checks`, async () => {
  const log = vi.spyOn(console, `log`).mockImplementation(() => {})
  const url = await serve(logRequests)

  await fetch(new URL(`/healthz`, url))
  await fetch(new URL(`/contests?token=secret`, url))

  await vi.waitFor(() => {
    expect(log).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/^GET \/contests 200 \d+ms$/u),
    )
  })
})
