import type { RequestHandler } from 'express'

const SECRET_PATH = /(?<prefix>\/api\/auth\/reset-password\/)[^/]+/u

// Logs each request without its query string, its secrets, or the client's IP
// address
export const logRequests: RequestHandler = (req, res, next) => {
  const start = performance.now()
  // `close` also fires when the client disconnects before the response ends
  res.on(`close`, () => {
    const duration = Math.round(performance.now() - start)
    console.log(
      `${req.method} ${redactPath(req.path)} ${res.statusCode} ${duration}ms`,
    )
  })
  next()
}

export const redactPath = (path: string): string =>
  path.replace(SECRET_PATH, `$<prefix>[redacted]`)
