import { createPrismaClient, prisma } from '../app/db.server.ts'
import { requireEnv } from '../app/env.server.ts'
import { importOldData } from './import.ts'
import type { ImportReport } from './import.ts'
import { readOldData } from './old-data.ts'

/**
 * Imports mmmm-old's database, restored from its dump at `OLD_DATABASE_URL`,
 * into `DATABASE_URL`. `--dry-run` only reports
 */
const main = async (): Promise<void> => {
  const isDryRun = process.argv.includes(`--dry-run`)
  const old = createPrismaClient(requireEnv(`OLD_DATABASE_URL`))
  try {
    const report = await importOldData(await readOldData(old), {
      isDryRun,
      now: new Date(),
    })
    printReport(report, isDryRun)
  } finally {
    await old.$disconnect()
    await prisma.$disconnect()
  }
}

/** IDs only, since names are mostly children's */
const printReport = (
  { imported, skipped, changed }: ImportReport,
  isDryRun: boolean,
): void => {
  console.log(isDryRun ? `Would import:` : `Imported:`)
  for (const [kind, count] of Object.entries(imported)) {
    console.log(`  ${kind}: ${count}`)
  }
  for (const [title, notes] of [
    [`Skipped`, skipped],
    [`Changed`, changed],
  ] as const) {
    for (const [reason, ids] of Object.entries(notes)) {
      console.log(`${title}, ${reason} (${ids.length}): ${ids.join(`, `)}`)
    }
  }
}

await main()
