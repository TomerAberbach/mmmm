import compression from 'compression'
import express from 'express'
import type { Express, RequestHandler } from 'express'
import { checkEmailSettings } from './app/email-settings.server.ts'
import {
  isDevelopment,
  isServedOverHttps,
  readAppEnv,
  requireEnv,
} from './app/env.server.ts'
import { forwardClientIp } from './server/client-ip.ts'
import { dropDisconnectedClients } from './server/disconnected-clients.ts'
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
const IS_DEVELOPMENT = isDevelopment()
const IS_SERVED_OVER_HTTPS = isServedOverHttps()
checkEmailSettings()
/** Staging fails to start without its password, so it's never public */
const STAGING_PASSWORD =
  readAppEnv() === `staging` ? requireEnv(`STAGING_PASSWORD`) : null

type AppModule = { app: RequestHandler; scheduleDailyJob: () => void }

/**
 * Each serves its assets, and returns the app's request handler and a function
 * that schedules its daily job
 */
const serveDevelopmentApp = async (server: Express): Promise<AppModule> => {
  const vite = await import(`vite`)
  const viteDevServer = await vite.createServer({
    server: { middlewareMode: true },
  })
  server.use(viteDevServer.middlewares)
  const loadApp = async () =>
    (await viteDevServer.ssrLoadModule(`./server/app.ts`)) as AppModule
  const { scheduleDailyJob } = await loadApp()
  return {
    scheduleDailyJob,
    app: async (req, res, next) => {
      try {
        const { app } = await loadApp()
        await app(req, res, next)
      } catch (error) {
        if (error instanceof Error) {
          viteDevServer.ssrFixStacktrace(error)
        }
        next(error)
      }
    },
  }
}

const serveProductionApp = async (server: Express): Promise<AppModule> => {
  server.use(
    `/assets`,
    express.static(`build/client/assets`, { immutable: true, maxAge: `1y` }),
  )
  server.use(express.static(`build/client`, { maxAge: `1h` }))
  return (await import(BUILD_PATH)) as AppModule
}

const server = express()
server.disable(`x-powered-by`)
// Fly.io sets `FLY_APP_NAME` on its machines, whose only hop is Fly's proxy.
// Anywhere else, trusting `X-Forwarded-For` would let clients forge their IP
if (process.env.FLY_APP_NAME) {
  server.set(`trust proxy`, 1)
}
server.use(compression())
server.use(setSecurityHeaders({ isServedOverHttps: IS_SERVED_OVER_HTTPS }))
const { app, scheduleDailyJob } = IS_DEVELOPMENT
  ? await serveDevelopmentApp(server)
  : await serveProductionApp(server)
// React Router needs every page's nonce, the health check's included
server.use(
  setContentSecurityPolicy({
    isDevelopment: IS_DEVELOPMENT,
    isServedOverHttps: IS_SERVED_OVER_HTTPS,
  }),
)
// Fly.io's health checks skip logging, rate limits, and the staging password
server.get(`/healthz`, app)
server.use(
  dropDisconnectedClients,
  logRequests,
  rejectCrossOriginRequests,
  // Generous, because a whole school can share one IP address
  limitRequestsPerIp(1000),
  forwardClientIp,
  ...(STAGING_PASSWORD ? [requireStagingPassword(STAGING_PASSWORD)] : []),
  app,
)
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`)
  scheduleDailyJob()
})
