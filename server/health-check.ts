import type { Request } from 'express'

// React Router matches paths case-insensitively and with a trailing slash
export const isHealthCheck = (req: Request): boolean =>
  /^\/healthz\/?$/iu.test(req.path)
