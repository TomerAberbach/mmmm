import type { TestProject } from 'vitest/node'
import { createTestDatabase, dropTemplateCopies } from './database.ts'

declare module 'vitest' {
  // Declaration merging requires an interface
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  export interface ProvidedContext {
    templateDatabase: string
  }
}

/** Creates the template that each worker copies its database from */
const setUpTemplateDatabase = async ({
  provide,
}: TestProject): Promise<() => Promise<void>> => {
  const template = await createTestDatabase()
  provide(`templateDatabase`, template.name)
  return async () => {
    await dropTemplateCopies(template.name)
    await template.drop()
  }
}
export default setUpTemplateDatabase
