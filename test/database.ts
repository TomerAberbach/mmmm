import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { createPrismaClient } from '../app/db.server.ts'
import { requireEnv } from '../app/env.server.ts'

type TestDatabase = {
  url: string
  drop: () => Promise<void>
}

// Creates an empty database with the schema on the server that
// `DATABASE_URL` points to
export const createTestDatabase = async (): Promise<TestDatabase> => {
  const serverUrl = new URL(requireEnv(`DATABASE_URL`))
  const name = `mmmm_test_${randomUUID().replaceAll(`-`, ``)}`
  const url = new URL(serverUrl)
  url.pathname = `/${name}`

  const drop = () =>
    runOnServer(serverUrl, `DROP DATABASE "${name}" WITH (FORCE)`)

  await runOnServer(serverUrl, `CREATE DATABASE "${name}"`)
  try {
    await pushSchema(url)
  } catch (error) {
    await drop()
    throw error
  }

  return { url: url.href, drop }
}

const runOnServer = async (serverUrl: URL, sql: string): Promise<void> => {
  const prisma = createPrismaClient(serverUrl.href)
  try {
    await prisma.$executeRawUnsafe(sql)
  } finally {
    await prisma.$disconnect()
  }
}

const pushSchema = async (url: URL): Promise<void> => {
  await promisify(execFile)(`node_modules/.bin/prisma`, [`db`, `push`], {
    env: { ...process.env, DATABASE_URL: url.href },
  })
}
