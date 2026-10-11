import { PrismaPg } from '@prisma/adapter-pg'
import { requireEnv } from './env.server.ts'
import { PrismaClient } from './generated/prisma/client.ts'

export const createPrismaClient = (connectionString: string): PrismaClient =>
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      // Pg waits forever for a connection by default
      connectionTimeoutMillis: 5000,
    }),
  })

export const prisma = createPrismaClient(requireEnv(`DATABASE_URL`))
