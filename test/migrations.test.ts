import { expect, test } from 'vitest'
import { requireEnv } from '../app/env.server.ts'
import { createMigratedDatabase, readDeclarations } from './database.ts'

test(`the migrations create the schema that pushing does`, async () => {
  await using databases = new AsyncDisposableStack()
  const migrated = await createMigratedDatabase()
  databases.defer(migrated.drop)
  const pushed = await readDeclarations(requireEnv(`DATABASE_URL`))

  const declarations = await readDeclarations(migrated.url)

  expect(declarations).toStrictEqual(pushed)
  // Reading neither's declarations would pass too
  expect(declarations).toContainEqual(
    expect.stringContaining(`Player_displayName_check`),
  )
}, 60_000)
