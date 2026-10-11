import { createTestDatabase } from '../test/database.ts'

const database = await createTestDatabase()
process.env.DATABASE_URL = database.url
const dropAndExit = () => {
  void database.drop().then(() => process.exit(0))
}
process.once(`SIGTERM`, dropAndExit)
process.once(`SIGINT`, dropAndExit)

await import(`../server.ts`)
