import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import express from 'express'
import type { RequestHandler } from 'express'
import { onTestFinished } from 'vitest'

// Serves the handlers in front of a route that responds with 200 and returns
// the server's URL. The server closes when the test finishes
export const serve = async (...handlers: RequestHandler[]): Promise<URL> => {
  const app = express()
  app.use(...handlers)
  app.use((_req, res) => {
    res.sendStatus(200)
  })
  const server = app.listen(0)
  await once(server, `listening`)
  onTestFinished(() => {
    server.close()
  })
  const { port } = server.address() as AddressInfo
  return new URL(`http://localhost:${port}`)
}
