import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'
import { prisma } from '../app/db.server.ts'

/**
 * Leaves out Vitest workers' databases, whose names end in the worker's number,
 * since other workers create theirs while this test runs
 */
const listTestDatabases = async (): Promise<string[]> => {
  const rows = await prisma.$queryRaw<{ datname: string }[]>`
    SELECT datname FROM pg_database WHERE datname ~ '^mmmm_test_[0-9a-f]+$'
  `
  return rows.map(row => row.datname).sort()
}

/**
 * The server first creates its database and pushes the schema, which takes
 * several seconds on a busy CI runner
 */
const SERVER_START_TIMEOUT_MS = 30_000

test(
  `the e2e server drops its database when the app fails to start`,
  async () => {
    const databasesBefore = await listTestDatabases()

    // Staging without its password stops the server during startup
    const start = promisify(execFile)(`node`, [`e2e/server.ts`], {
      env: {
        ...process.env,
        APP_ENV: `staging`,
        EMAIL_TRANSPORT: `resend`,
        RESEND_API_KEY: `re_test`,
        STAGING_PASSWORD: ``,
      },
    })

    await expect(start).rejects.toThrow(`Set STAGING_PASSWORD`)
    await expect(listTestDatabases()).resolves.toStrictEqual(databasesBefore)
  },
  SERVER_START_TIMEOUT_MS,
)
