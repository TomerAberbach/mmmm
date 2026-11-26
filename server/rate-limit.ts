import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'

const TOO_MANY_REQUESTS = `Too many requests right now. Try again in 1 minute`

/**
 * Counts requests per IP address in memory, grouping IPv6 addresses by /56
 * network. Throws on a request with no IP address, so stop a disconnected
 * client's request before it
 */
export const limitRequestsPerIp = (limitPerMinute: number): RequestHandler =>
  rateLimit({
    windowMs: 60_000,
    limit: limitPerMinute,
    message: TOO_MANY_REQUESTS,
    standardHeaders: `draft-8`,
    legacyHeaders: false,
  })

/** Counts only requests answered 401, so a guard below it can't be guessed */
export const limitFailedLoginsPerIp = (
  limitPerMinute: number,
): RequestHandler =>
  rateLimit({
    windowMs: 60_000,
    limit: limitPerMinute,
    message: TOO_MANY_REQUESTS,
    standardHeaders: `draft-8`,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) => res.statusCode !== 401,
  })
