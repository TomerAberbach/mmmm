import type { Request, RequestHandler } from 'express'
import helmet from 'helmet'
import { createNonce, readNonce } from './nonce.ts'

// Every header but the content security policy, which only pages need
export const setSecurityHeaders = (isProduction: boolean): RequestHandler =>
  helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: isProduction,
  })

export const setContentSecurityPolicy = (
  isProduction: boolean,
): RequestHandler[] => [
  createNonce,
  helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      defaultSrc: [`'self'`],
      baseUri: [`'none'`],
      // Vite's client connects over a WebSocket in development
      connectSrc: [`'self'`, ...(isProduction ? [] : [`ws:`])],
      formAction: [`'self'`],
      frameAncestors: [`'none'`],
      imgSrc: [`'self'`, `data:`],
      objectSrc: [`'none'`],
      scriptSrc: [`'self'`, (_req, res) => `'nonce-${readNonce(res)}'`],
      // Vite injects styles inline in development. The hash allows the
      // <style> React Aria adds for pressable elements, which sets
      // `touch-action`. Browsers ignore 'unsafe-inline' beside a hash, so
      // development omits the hash
      styleSrc: [
        `'self'`,
        isProduction
          ? `'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='`
          : `'unsafe-inline'`,
      ],
      // React Aria positions and hides elements with style attributes. Those
      // can't run scripts, and other <style> elements stay blocked
      styleSrcAttr: [`'unsafe-inline'`],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  }),
]

const SAFE_METHODS = new Set([`GET`, `HEAD`, `OPTIONS`])

// Rejects requests that change data when a browser sent them from another
// site, following the checks in Go's `http.CrossOriginProtection`
export const rejectCrossOriginRequests: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method) || isSameOrigin(req)) {
    next()
    return
  }
  res.status(403).send(`Cross-origin request rejected`)
}

const isSameOrigin = (req: Request): boolean => {
  const site = req.get(`sec-fetch-site`)
  if (site) {
    return site === `same-origin` || site === `none`
  }
  // Browsers send `Origin` on every POST, so a request without either header
  // didn't come from a browser
  const origin = req.get(`origin`)
  return !origin || URL.parse(origin)?.host === req.get(`host`)
}
