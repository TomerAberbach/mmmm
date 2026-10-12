import type { RequestHandler } from 'express'
import { expect, test } from 'vitest'
import { CLIENT_IP_HEADER } from '../app/client-ip.ts'
import { serve } from '../test/http.ts'
import { forwardClientIp } from './client-ip.ts'

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
