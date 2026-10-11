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
  // Off because its limit of 3 sign-ins per 10 seconds per IP address would
  // block a school that shares one address
  rateLimit: { enabled: false },
  // Nothing stores IP addresses
  databaseHooks: {
    session: {
      create: {
        before: session =>
          Promise.resolve({ data: { ...session, ipAddress: null } }),
      },
    },
  },
})
