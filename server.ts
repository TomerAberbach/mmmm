import compression from 'compression'
import express from 'express'
import type { Express, RequestHandler } from 'express'
import { requireEnv } from './app/env.server.ts'
import { logRequests } from './server/logging.ts'
import { limitRequestsPerIp } from './server/rate-limit.ts'
import {
  rejectCrossOriginRequests,
  setContentSecurityPolicy,
  setSecurityHeaders,
} from './server/security.ts'
import { requireStagingPassword } from './server/staging-password.ts'

const PORT = Number.parseInt(process.env.PORT ?? `3000`, 10)
const BUILD_PATH = `./build/server/index.js`
const IS_PRODUCTION = process.env.NODE_ENV !== `development`
// Staging fails to start without its password, so it's never public
const STAGING_PASSWORD =
  process.env.APP_ENV === `staging` ? requireEnv(`STAGING_PASSWORD`) : null

// Each serves its assets and returns the app's request handler
const serveDevelopmentApp = async (
  server: Express,
): Promise<RequestHandler> => {
  const vite = await import(`vite`)
  const viteDevServer = await vite.createServer({
    server: { middlewareMode: true },
  })
  server.use(viteDevServer.middlewares)
  return async (req, res, next) => {
    try {
      const { app } = (await viteDevServer.ssrLoadModule(
        `./server/app.ts`,
      )) as { app: RequestHandler }
      await app(req, res, next)
    } catch (error) {
      if (error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error)
      }
      next(error)
    }
  }
}

const serveProductionApp = async (server: Express): Promise<RequestHandler> => {
  server.use(
    `/assets`,
    express.static(`build/client/assets`, { immutable: true, maxAge: `1y` }),
  )
  server.use(express.static(`build/client`, { maxAge: `1h` }))
  const { app } = (await import(BUILD_PATH)) as { app: RequestHandler }
  return app
}

const server = express()
server.disable(`x-powered-by`)
if (IS_PRODUCTION) {
  // Fly.io's proxy is the only hop in front of the app
  server.set(`trust proxy`, 1)
}
server.use(compression())
server.use(setSecurityHeaders(IS_PRODUCTION))
const app = IS_PRODUCTION
  ? await serveProductionApp(server)
  : await serveDevelopmentApp(server)
// React Router needs every page's nonce, the health check's included
server.use(setContentSecurityPolicy(IS_PRODUCTION))
// Fly.io's health checks skip logging, rate limits, and the staging password
server.get(`/healthz`, app)
server.use(
  logRequests,
  rejectCrossOriginRequests,
  // Generous, because a whole school can share one IP address
  limitRequestsPerIp(1000),
  ...(STAGING_PASSWORD ? [requireStagingPassword(STAGING_PASSWORD)] : []),
  app,
)
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`)
})
