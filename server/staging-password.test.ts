import { expect, test } from 'vitest'
import { serve } from '../test/http.ts'
import { requireStagingPassword } from './staging-password.ts'

const basic = (credentials: string) =>
  `Basic ${Buffer.from(credentials).toString(`base64`)}`

test.each([
  { authorization: undefined, status: 401 },
  { authorization: basic(`tester:wrong`), status: 401 },
  { authorization: basic(`secret`), status: 401 },
  { authorization: `Bearer secret`, status: 401 },
  { authorization: basic(`tester:secret`), status: 200 },
  { authorization: basic(`anyone:secret`), status: 200 },
  {
    authorization: basic(`anyone:secret`).replace(`Basic`, `basic`),
    status: 200,
  },
])(
  `a request with authorization $authorization responds with $status`,
  async ({ authorization, status }) => {
    const url = await serve(requireStagingPassword(`secret`))

    const response = await fetch(url, {
      headers: authorization ? { authorization } : {},
    })

    expect(response.status).toBe(status)
  },
)

test(`a request without the password is told to log in`, async () => {
  const url = await serve(requireStagingPassword(`secret`))

  const response = await fetch(url)

  expect(response.headers.get(`www-authenticate`)).toBe(
    `Basic realm="Staging", charset="UTF-8"`,
  )
})

test(`health checks don't need the password`, async () => {
  const url = await serve(requireStagingPassword(`secret`))

  const response = await fetch(new URL(`/healthz`, url))

  expect(response.status).toBe(200)
})
