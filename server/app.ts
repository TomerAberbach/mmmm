import { createRequestHandler } from '@react-router/express'

export const app = createRequestHandler({
  build: async () => import(`virtual:react-router/server-build`),
})
