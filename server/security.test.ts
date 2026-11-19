import { expect, test } from 'vitest'
import { serve } from '../test/http.ts'
import {
  rejectCrossOriginRequests,
  setContentSecurityPolicy,
  setSecurityHeaders,
} from './security.ts'

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

const serveWithSecurityHeaders = (isServedOverHttps: boolean) =>
  serve(
    setSecurityHeaders({ isServedOverHttps }),
    ...setContentSecurityPolicy({ isDevelopment: false, isServedOverHttps }),
  )

test(`an app served over HTTPS tells browsers to keep using HTTPS`, async () => {
  const url = await serveWithSecurityHeaders(true)

  const response = await fetch(url)

  expect(response.headers.get(`strict-transport-security`)).toBe(
    `max-age=31536000; includeSubDomains`,
  )
  expect(response.headers.get(`content-security-policy`)).toContain(
    `upgrade-insecure-requests`,
  )
})

test(`an app served over HTTP leaves browsers on HTTP`, async () => {
  const url = await serveWithSecurityHeaders(false)

  const response = await fetch(url)

  expect(response.headers.has(`strict-transport-security`)).toBe(false)
  expect(response.headers.get(`content-security-policy`)).not.toContain(
    `upgrade-insecure-requests`,
  )
})
