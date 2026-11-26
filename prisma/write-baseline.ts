import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { readConstraintsSql } from './push-schema.ts'

/**
 * Rewrites the baseline migration from schema.prisma and the CHECK constraints.
 * Run it only until production's database exists, with `pnpm db:baseline`
 */
const schemaSql = execFileSync(
  `node_modules/.bin/prisma`,
  [
    `migrate`,
    `diff`,
    `--from-empty`,
    `--to-schema`,
    `prisma/schema.prisma`,
    `--script`,
  ],
  { encoding: `utf8` },
)
writeFileSync(
  `prisma/migrations/0_baseline/migration.sql`,
  `${schemaSql}\n-- CHECK constraints\n${readConstraintsSql()}\n`,
)
