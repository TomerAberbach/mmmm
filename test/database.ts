import { randomUUID } from 'node:crypto'
import { createPrismaClient } from '../app/db.server.ts'
import { requireEnv } from '../app/env.server.ts'
import { pushSchema } from '../prisma/push-schema.ts'
import { CREATE_YEAR_SEQUENCE_SQL } from './years.ts'

type TestDatabase = {
  url: string
  drop: () => Promise<void>
}

// Creates an empty database with the schema and the sequence that `claimYear`
// reads, on the server that `DATABASE_URL` points to
export const createTestDatabase = async (): Promise<TestDatabase> => {
  const serverUrl = new URL(requireEnv(`DATABASE_URL`))
  const name = `mmmm_test_${randomUUID().replaceAll(`-`, ``)}`
  const url = new URL(serverUrl)
  url.pathname = `/${name}`

  const drop = () => runSql(serverUrl, `DROP DATABASE "${name}" WITH (FORCE)`)

  await runSql(serverUrl, `CREATE DATABASE "${name}"`)
  try {
    await pushSchema({ env: { ...process.env, DATABASE_URL: url.href } })
    await runSql(url, CREATE_YEAR_SEQUENCE_SQL)
  } catch (error) {
    await drop()
    throw error
  }

  return { url: url.href, drop }
}

const runSql = async (databaseUrl: URL, sql: string): Promise<void> => {
  const prisma = createPrismaClient(databaseUrl.href)
  try {
    await prisma.$executeRawUnsafe(sql)
  } finally {
    await prisma.$disconnect()
  }
}
