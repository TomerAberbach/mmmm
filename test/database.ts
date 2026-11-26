import { randomUUID } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { requireEnv } from '../app/env.server.ts'
import { PrismaClient } from '../app/generated/prisma/client.ts'
import { requireDisposableDatabase } from '../prisma/local-database.ts'
import { migrate, pushSchema } from '../prisma/push-schema.ts'

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
export const createTestDatabase = (): Promise<TestDatabase> =>
  createDatabaseWith(`mmmm_test_${randomId()}`, async ({ url }) => {
    await pushSchema({ env: { ...process.env, DATABASE_URL: url } })
    await runSql(new URL(url), CREATE_YEAR_SEQUENCE_SQL)
  })

/** Creates a database as production's is, by applying the migrations */
export const createMigratedDatabase = (): Promise<TestDatabase> =>
  createDatabaseWith(`mmmm_test_migrated_${randomId()}`, ({ url }) =>
    migrate({ ...process.env, DATABASE_URL: url }),
  )

/** Drops the database when setting it up fails */
const createDatabaseWith = async (
  name: string,
  setUp: (database: TestDatabase) => Promise<void>,
): Promise<TestDatabase> => {
  const database = await createDatabase(name)
  try {
    await setUp(database)
  } catch (error) {
    await database.drop()
    throw error
  }
  return database
}

const randomId = (): string => randomUUID().replaceAll(`-`, ``)

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

const readServerUrl = (): URL => {
  requireDisposableDatabase()
  return new URL(requireEnv(`DATABASE_URL`))
}

const toDatabaseUrl = (serverUrl: URL, name: string): string => {
  const url = new URL(serverUrl)
  url.pathname = `/${name}`
  return url.href
}

const runSql = async (databaseUrl: URL, sql: string): Promise<void> => {
  await withClient(databaseUrl, prisma => prisma.$executeRawUnsafe(sql))
}

/** What the database declares, apart from its rows, one line for each part */
export const readDeclarations = async (url: string): Promise<string[]> => {
  const rows = await querySql<{ declaration: string }>(
    new URL(url),
    READ_DECLARATIONS_SQL,
  )
  return rows.map(({ declaration }) => declaration)
}

/** Leaves out Prisma's own table of applied migrations */
const READ_DECLARATIONS_SQL = `
  SELECT declaration FROM (
    SELECT concat_ws(' ', 'column', table_name, column_name, udt_name,
      is_nullable, column_default, character_maximum_length,
      datetime_precision, numeric_precision, numeric_scale) AS declaration,
      table_name::text AS relation
    FROM information_schema.columns WHERE table_schema = 'public'
    UNION ALL
    SELECT concat_ws(' ', 'index', indexdef), tablename::text
    FROM pg_indexes WHERE schemaname = 'public'
    UNION ALL
    SELECT concat_ws(' ', 'constraint', conrelid::regclass, conname,
      pg_get_constraintdef(oid)), conrelid::regclass::text
    FROM pg_constraint WHERE connamespace = 'public'::regnamespace
    UNION ALL
    SELECT concat_ws(' ', 'enum', enumtypid::regtype, row_number() OVER (
      PARTITION BY enumtypid ORDER BY enumsortorder), enumlabel), ''
    FROM pg_enum
  ) declarations
  WHERE relation NOT IN ('_prisma_migrations') ORDER BY declaration`

const querySql = <Row = { datname: string }>(
  databaseUrl: URL,
  sql: string,
  ...values: unknown[]
): Promise<Row[]> =>
  withClient(databaseUrl, prisma =>
    prisma.$queryRawUnsafe<Row[]>(sql, ...values),
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
