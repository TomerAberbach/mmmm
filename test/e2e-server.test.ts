import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'
import { prisma } from '../app/db.server.ts'

const listTestDatabases = async (): Promise<string[]> => {
  const rows = await prisma.$queryRaw<{ datname: string }[]>`
    SELECT datname FROM pg_database WHERE datname LIKE 'mmmm_test_%'
  `
  return rows.map(row => row.datname).sort()
}

test(`the e2e server drops its database when the app fails to start`, async () => {
  const databasesBefore = await listTestDatabases()

  // Staging without its password stops the server during startup
  const start = promisify(execFile)(`node`, [`e2e/server.ts`], {
    env: { ...process.env, APP_ENV: `staging`, STAGING_PASSWORD: `` },
  })

  await expect(start).rejects.toThrow(`Set STAGING_PASSWORD`)
  await expect(listTestDatabases()).resolves.toStrictEqual(databasesBefore)
})
