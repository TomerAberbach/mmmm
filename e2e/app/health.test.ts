import { expect, test } from '@playwright/test'

test(`the health check reports the database as up`, async ({ request }) => {
  const response = await request.get(`/healthz`)

  expect(response.status()).toBe(200)
  expect(await response.json()).toStrictEqual({ database: `up` })
})
