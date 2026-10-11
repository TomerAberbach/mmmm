import { defineConfig } from 'prisma/config'
import './app/env.server.ts'

export default defineConfig({
  // Knip reads the schema path from here
  schema: `prisma/schema.prisma`,
  datasource: { url: process.env.DATABASE_URL },
  migrations: { seed: `node prisma/seed.ts` },
})
