import type { RequestHandler } from 'express'
import { CLIENT_IP_HEADER } from '../app/client-ip.ts'

// Passes Express's view of the client's IP address, which honors `trust proxy`,
// to the app. It replaces whatever the client sent, so no one can forge it
export const forwardClientIp: RequestHandler = (req, _res, next) => {
  req.headers[CLIENT_IP_HEADER] = req.ip ?? `unknown`
  next()
}
