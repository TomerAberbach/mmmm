import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireEnv } from '../app/env.server.ts'
import { PrismaClient } from '../app/generated/prisma/client.ts'
import { pushSchema } from '../prisma/push-schema.ts'

// This module imports nothing that loads `app/db.server.ts`, whose `prisma`
// connects to `DATABASE_URL` on import, before `test/setup.ts` sets it

type TestDatabase = {
  name: string
  url: string
  drop: () => Promise<void>
}

/** The sequence `claimYear` in `test/years.ts` reads */
const CREATE_YEAR_SEQUENCE_SQL = `CREATE SEQUENCE test_year START 2100`

/**
 * Creates an empty database with the schema and the sequence that
 * `test/years.ts` reads, on the server that `DATABASE_URL` points to
 */
export const createTestDatabase = async (): Promise<TestDatabase> => {
  const database = await createDatabase(
    `mmmm_test_${randomUUID().replaceAll(`-`, ``)}`,
  )
  try {
    await pushSchema({ env: { ...process.env, DATABASE_URL: database.url } })
    await runSql(new URL(database.url), CREATE_YEAR_SEQUENCE_SQL)
  } catch (error) {
    await database.drop()
    throw error
  }
  return database
}

/**
 * Returns the URL of the template's copy named for `suffix`, creating the copy
 * if it doesn't exist yet. Two calls with the same suffix must not run at once
 */
export const ensureTemplateCopy = async (
  template: string,
  suffix: string,
): Promise<string> => {
  const serverUrl = readServerUrl()
  const name = `${template}_${suffix}`
  const existing = await querySql(
    serverUrl,
    `SELECT datname FROM pg_database WHERE datname = $1`,
    name,
  )
  return existing.length > 0
    ? toDatabaseUrl(serverUrl, name)
    : (await createDatabase(name, template)).url
}

/** Drops every copy that `ensureTemplateCopy` made of the template */
export const dropTemplateCopies = async (template: string): Promise<void> => {
  const serverUrl = readServerUrl()
  const copies = await querySql(
    serverUrl,
    `SELECT datname FROM pg_database WHERE starts_with(datname, $1)`,
    `${template}_`,
  )
  await Promise.all(
    copies.map(({ datname }) => dropDatabase(serverUrl, datname)),
  )
}

const createDatabase = async (
  name: string,
  template?: string,
): Promise<TestDatabase> => {
  const serverUrl = readServerUrl()
  const templateClause = template === undefined ? `` : ` TEMPLATE "${template}"`
  await runSql(serverUrl, `CREATE DATABASE "${name}"${templateClause}`)
  return {
    name,
    url: toDatabaseUrl(serverUrl, name),
    drop: () => dropDatabase(serverUrl, name),
  }
}

const dropDatabase = (serverUrl: URL, name: string): Promise<void> =>
  runSql(serverUrl, `DROP DATABASE "${name}" WITH (FORCE)`)

const readServerUrl = (): URL => new URL(requireEnv(`DATABASE_URL`))

const toDatabaseUrl = (serverUrl: URL, name: string): string => {
  const url = new URL(serverUrl)
  url.pathname = `/${name}`
  return url.href
}

const runSql = async (databaseUrl: URL, sql: string): Promise<void> => {
  await withClient(databaseUrl, prisma => prisma.$executeRawUnsafe(sql))
}

const querySql = (
  databaseUrl: URL,
  sql: string,
  ...values: unknown[]
): Promise<{ datname: string }[]> =>
  withClient(databaseUrl, prisma =>
    prisma.$queryRawUnsafe<{ datname: string }[]>(sql, ...values),
  )

const withClient = async <Result>(
  databaseUrl: URL,
  run: (prisma: PrismaClient) => Promise<Result>,
): Promise<Result> => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl.href }),
  })
  try {
    return await run(prisma)
  } finally {
    await prisma.$disconnect()
  }
}
