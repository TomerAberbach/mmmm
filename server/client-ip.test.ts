import express from 'express'
import type { RequestHandler } from 'express'
import { expect, test } from 'vitest'
import { CLIENT_IP_HEADER } from '../app/client-ip.ts'
import { serve } from '../test/http.ts'
import { forwardClientIp, trustFlyProxy } from './client-ip.ts'

const echoClientIp: RequestHandler = (req, res) => {
  res.send(req.headers[CLIENT_IP_HEADER])
}

test(`the app receives the connection's address in place of the one the client sends`, async () => {
  const url = await serve(forwardClientIp, echoClientIp)

  const response = await fetch(url, {
    headers: { [CLIENT_IP_HEADER]: `203.0.113.7` },
  })

  await expect(response.text()).resolves.toMatch(
    /^(?:::1|::ffff:127\.0\.0\.1|127\.0\.0\.1)$/u,
  )
})

test.each([
  [`the client's address`, `203.0.113.7, 198.51.100.2`],
  [
    `the client's address, whatever addresses the client sent`,
    `192.0.2.1, 203.0.113.7, 198.51.100.2`,
  ],
])(`behind Fly's proxy, the app receives %s`, async (_, forwardedFor) => {
  const server = express()
  trustFlyProxy(server)
  server.use(forwardClientIp, echoClientIp)
  const url = await serve(server)

  const response = await fetch(url, {
    headers: { 'X-Forwarded-For': forwardedFor },
  })

  await expect(response.text()).resolves.toBe(`203.0.113.7`)
})
