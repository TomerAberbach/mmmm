import type { ChildProcess } from 'node:child_process'
import { createTestDatabase } from '../test/database.ts'
import {
  requireFreePort,
  spawnServer,
  stopServer,
  waitUntilReady,
} from './server.ts'

await requireFreePort()
const database = await createTestDatabase()
// The app connects to it on import
process.env.DATABASE_URL = database.url
const { prisma } = await import(`../app/db.server.ts`)
const { fillDatabase } = await import(`./data.ts`)
const { runPicking } = await import(`./picking.ts`)
const { runReading } = await import(`./reading.ts`)

let server: ChildProcess | undefined
const dropAndExit = (): void => {
  server?.kill()
  void database.drop().then(() => process.exit(1))
}
process.once(`SIGTERM`, dropAndExit)
process.once(`SIGINT`, dropAndExit)

try {
  await fillDatabase()
  server = spawnServer()
  await waitUntilReady(server)
  await runPicking()
  await runReading()
} finally {
  if (server) {
    await stopServer(server)
  }
  await prisma.$disconnect()
  await database.drop()
}
