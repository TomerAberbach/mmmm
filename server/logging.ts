import type { RequestHandler } from 'express'

/**
 * Reset links, contest links, personal links, and links that confirm a new
 * address. React Router matches paths in any case
 */
const SECRET_PATH =
  /(?<prefix>\/(?:api\/auth\/reset-password|play|my-bracket|confirm-address)\/)[^/]+/iu

/**
 * Logs each request without its query string, its secrets, or the client's IP
 * address
 */
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
  decodeLetters(path).replace(SECRET_PATH, `$<prefix>[redacted]`)

/**
 * An encoded letter or hyphen could otherwise hide a prefix from `SECRET_PATH`.
 * The rest stays encoded, since a decoded line break could forge a log line
 */
const decodeLetters = (path: string): string =>
  path.replaceAll(/%(?:2d|[46][1-9a-f]|[57][0-9a])/giu, encoded =>
    decodeURIComponent(encoded),
  )
