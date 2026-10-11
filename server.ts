import compression from 'compression'
import express from 'express'
import type { Express, RequestHandler } from 'express'
import { logRequests } from './server/logging.ts'
import { limitRequestsPerIp } from './server/rate-limit.ts'
import {
  rejectCrossOriginRequests,
  setContentSecurityPolicy,
  setSecurityHeaders,
} from './server/security.ts'

const PORT = Number.parseInt(process.env.PORT ?? `3000`, 10)
const BUILD_PATH = `./build/server/index.js`
const IS_PRODUCTION = process.env.NODE_ENV !== `development`

// Each serves its assets, then the app behind `appMiddleware`, which assets
// skip
const serveDevelopmentApp = async (
  server: Express,
  appMiddleware: RequestHandler[],
) => {
  const vite = await import(`vite`)
  const viteDevServer = await vite.createServer({
    server: { middlewareMode: true },
  })
  server.use(viteDevServer.middlewares)
  server.use(...appMiddleware, async (req, res, next) => {
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
  })
}

const serveProductionApp = async (
  server: Express,
  appMiddleware: RequestHandler[],
) => {
  server.use(
    `/assets`,
    express.static(`build/client/assets`, { immutable: true, maxAge: `1y` }),
  )
  server.use(express.static(`build/client`, { maxAge: `1h` }))
  const { app } = (await import(BUILD_PATH)) as { app: RequestHandler }
  server.use(...appMiddleware, app)
}

const server = express()
server.disable(`x-powered-by`)
if (IS_PRODUCTION) {
  // Fly.io's proxy is the only hop in front of the app
  server.set(`trust proxy`, 1)
}
server.use(compression())
server.use(setSecurityHeaders(IS_PRODUCTION))
const appMiddleware = [
  logRequests,
  rejectCrossOriginRequests,
  ...setContentSecurityPolicy(IS_PRODUCTION),
  // Generous, because a whole school can share one IP address
  limitRequestsPerIp(1000),
]
if (IS_PRODUCTION) {
  await serveProductionApp(server, appMiddleware)
} else {
  await serveDevelopmentApp(server, appMiddleware)
}
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`)
})
