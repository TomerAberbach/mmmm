import type { RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'
import { isHealthCheck } from './health-check.ts'

// Counts requests per IP address in memory, grouping IPv6 addresses by /56
// network. Fly.io's health checks don't count
export const limitRequestsPerIp = (limitPerMinute: number): RequestHandler =>
  rateLimit({
    windowMs: 60_000,
    limit: limitPerMinute,
    standardHeaders: `draft-8`,
    legacyHeaders: false,
    skip: isHealthCheck,
  })
