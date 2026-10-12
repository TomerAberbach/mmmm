import { timingSafeEqual } from 'node:crypto'
import type { Request, RequestHandler } from 'express'

// Asks for a shared password, so only testers can reach staging. Any username
// works
export const requireStagingPassword = (password: string): RequestHandler => {
  const expected = Buffer.from(password)
  return (req, res, next) => {
    if (hasPassword(req, expected)) {
      next()
      return
    }
    res.set(`WWW-Authenticate`, `Basic realm="Staging", charset="UTF-8"`)
    res.status(401).send(`Staging requires a password`)
  }
}

const hasPassword = (req: Request, expected: Buffer): boolean => {
  const [scheme, encoded] = req.get(`authorization`)?.split(` `) ?? []
  if (scheme?.toLowerCase() !== `basic` || !encoded) {
    return false
  }
  const credentials = Buffer.from(encoded, `base64`).toString()
  const colon = credentials.indexOf(`:`)
  if (colon === -1) {
    return false
  }
  const given = Buffer.from(credentials.slice(colon + 1))
  return given.length === expected.length && timingSafeEqual(given, expected)
}
