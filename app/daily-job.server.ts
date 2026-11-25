import { Cron } from 'croner'
import { ARIZONA_TIME_ZONE } from './dates.ts'
import { prisma } from './db.server.ts'
import { eraseExpiredPlayers } from './trash.server.ts'

/** Erases data whose retention period has ended */
export const runDailyJob = async (): Promise<void> => {
  const count = await eraseExpiredPlayers(new Date())
  console.log(`Daily job: erased ${count} brackets their players deleted`)
}

const runDailyJobOrLog = async (): Promise<void> => {
  try {
    await runDailyJob()
  } catch (error) {
    console.error(`Daily job failed`, error)
  }
}

/** Also runs the job now, since a stopped machine misses its time */
export const scheduleDailyJob = (): void => {
  void runDailyJobOrLog()
  const _job = new Cron(
    `0 2 * * *`,
    { timezone: ARIZONA_TIME_ZONE },
    runDailyJobOrLog,
  )
}

if (process.argv[1] === import.meta.filename) {
  await runDailyJob()
  await prisma.$disconnect()
}
