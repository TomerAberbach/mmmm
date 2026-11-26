import type { Express, RequestHandler } from 'express'
import { CLIENT_IP_HEADER } from '../app/client-ip.ts'

/**
 * Reads a client's IP address from `X-Forwarded-For` as Fly.io sends it: the
 * client's address, then one of the app's own addresses
 */
export const trustFlyProxy = (server: Express): void => {
  server.set(`trust proxy`, FLY_HOPS)
}

/** Fly's proxy, and the app's own address */
const FLY_HOPS = 2

/**
 * Passes Express's view of the client's IP address, which honors `trust proxy`,
 * to the app. It replaces whatever the client sent, so no one can forge it
 */
export const forwardClientIp: RequestHandler = (req, _res, next) => {
  req.headers[CLIENT_IP_HEADER] = req.ip
  next()
}
