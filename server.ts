import compression from 'compression'
import express from 'express'
import type { Express, RequestHandler } from 'express'

const PORT = Number.parseInt(process.env.PORT ?? `3000`, 10)
const BUILD_PATH = `./build/server/index.js`

const serveDevelopmentApp = async (server: Express) => {
  const vite = await import(`vite`)
  const viteDevServer = await vite.createServer({
    server: { middlewareMode: true },
  })
  server.use(viteDevServer.middlewares)
  server.use(async (req, res, next) => {
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

const serveProductionApp = async (server: Express) => {
  server.use(
    `/assets`,
    express.static(`build/client/assets`, { immutable: true, maxAge: `1y` }),
  )
  server.use(express.static(`build/client`, { maxAge: `1h` }))
  const { app } = (await import(BUILD_PATH)) as { app: RequestHandler }
  server.use(app)
}

const server = express()
server.disable(`x-powered-by`)
server.use(compression())
if (process.env.NODE_ENV === `development`) {
  await serveDevelopmentApp(server)
} else {
  await serveProductionApp(server)
}
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`)
})
