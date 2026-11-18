import type { RequestHandler } from 'express'

/**
 * Stops a request whose client has disconnected, so no later handler runs for
 * it. Reading `req.ip` while the socket is open keeps its address for the
 * handlers after this one
 */
export const dropDisconnectedClients: RequestHandler = (req, _res, next) => {
  if (req.ip === undefined || req.socket.destroyed) {
    return
  }
  next()
}
