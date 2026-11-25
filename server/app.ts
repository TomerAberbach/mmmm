import { createRequestHandler } from '@react-router/express'
import { RouterContextProvider } from 'react-router'
import { nonceContext } from '../app/nonce.ts'
import { readNonce } from './nonce.ts'

export { scheduleDailyJob } from '../app/daily-job.server.ts'

export const app = createRequestHandler({
  build: async () => import(`virtual:react-router/server-build`),
  getLoadContext: (_req, res) => {
    const context = new RouterContextProvider()
    context.set(nonceContext, readNonce(res))
    return context
  },
})
