import type { TestProject } from 'vitest/node'
import { createTestDatabase } from './database.ts'

declare module 'vitest' {
  // Declaration merging requires an interface
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  export interface ProvidedContext {
    databaseUrl: string
  }
}

const setUpTestDatabase = async ({
  provide,
}: TestProject): Promise<() => Promise<void>> => {
  const database = await createTestDatabase()
  provide(`databaseUrl`, database.url)
  return database.drop
}
export default setUpTestDatabase
