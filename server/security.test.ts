import { expect, test } from 'vitest'
import { serve } from '../test/http.ts'
import { rejectCrossOriginRequests } from './security.ts'

test.each<{ method: string; headers: Record<string, string>; status: number }>([
  { method: `POST`, headers: { 'sec-fetch-site': `same-origin` }, status: 200 },
  { method: `POST`, headers: { 'sec-fetch-site': `none` }, status: 200 },
  { method: `POST`, headers: { 'sec-fetch-site': `cross-site` }, status: 403 },
  { method: `POST`, headers: { 'sec-fetch-site': `same-site` }, status: 403 },
  { method: `POST`, headers: { origin: `https://evil.example` }, status: 403 },
  { method: `POST`, headers: {}, status: 200 },
  { method: `GET`, headers: { 'sec-fetch-site': `cross-site` }, status: 200 },
])(
  `a $method with $headers responds with $status`,
  async ({ method, headers, status }) => {
    const url = await serve(rejectCrossOriginRequests)

    const response = await fetch(url, { method, headers })

    expect(response.status).toBe(status)
  },
)

test(`a POST whose Origin matches the host is allowed`, async () => {
  const url = await serve(rejectCrossOriginRequests)

  const response = await fetch(url, {
    method: `POST`,
    headers: { origin: url.origin },
  })

  expect(response.status).toBe(200)
})
