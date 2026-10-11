import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './db.server.ts'
import { requireEnv } from './env.server.ts'

export const auth = betterAuth({
  baseURL: requireEnv(`BETTER_AUTH_URL`),
  secret: requireEnv(`BETTER_AUTH_SECRET`),
  database: prismaAdapter(prisma, { provider: `postgresql` }),
  user: { modelName: `educator` },
  session: { fields: { userId: `educatorId` } },
  account: { modelName: `credential`, fields: { userId: `educatorId` } },
  emailAndPassword: { enabled: true },
})
