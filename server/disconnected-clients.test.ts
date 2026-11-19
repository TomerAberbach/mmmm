import type { RequestHandler } from 'express'
import { expect, test, vi } from 'vitest'
import { serve } from '../test/http.ts'
import { dropDisconnectedClients } from './disconnected-clients.ts'

/** Disconnects the client, then resolves once the later handlers return */
const disconnectClient =
  (handled: PromiseWithResolvers<undefined>): RequestHandler =>
  (request, _response, next) => {
    request.socket.destroy()
    next()
    handled.resolve(undefined)
  }

test(`a request whose client disconnected reaches no later handler`, async () => {
  const handled = Promise.withResolvers<undefined>()
  const laterHandler = vi.fn<RequestHandler>()
  const url = await serve(
    disconnectClient(handled),
    dropDisconnectedClients,
    laterHandler,
  )

  await fetch(url).catch(() => {})
  await handled.promise

  expect(laterHandler).not.toHaveBeenCalled()
})

test(`a request whose client is connected reaches the later handlers`, async () => {
  const url = await serve(dropDisconnectedClients)

  const response = await fetch(url)

  expect(response.status).toBe(200)
})
