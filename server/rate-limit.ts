import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'

// Counts requests per IP address in memory, grouping IPv6 addresses by /56
// network
export const limitRequestsPerIp = (limitPerMinute: number): RequestHandler =>
  rateLimit({
    windowMs: 60_000,
    limit: limitPerMinute,
    standardHeaders: `draft-8`,
    legacyHeaders: false,
  })
