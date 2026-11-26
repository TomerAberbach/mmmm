import { Cron } from 'croner'
import { ARIZONA_TIME_ZONE } from './dates.ts'
import { prisma } from './db.server.ts'
import { deleteExpiredSignIns } from './expired-sign-ins.server.ts'
import { removeExpiredNames } from './name-removal.server.ts'
import { eraseExpiredPlayers } from './trash.server.ts'

/** Each step of the job resolves to how many rows it changed */
const STEPS: Record<string, (now: Date) => Promise<number>> = {
  'erase brackets their players deleted': eraseExpiredPlayers,
  'delete expired sessions and links': deleteExpiredSignIns,
  'remove display names two years after their tournament': removeExpiredNames,
}

/**
 * Erases data whose retention period has ended. Returns whether every step
 * succeeded. A failed step doesn't stop the others
 */
export const runDailyJob = async (): Promise<boolean> => {
  let succeeded = true
  for (const [description, run] of Object.entries(STEPS)) {
    try {
      const count = await run(new Date())
      console.log(`Daily job: ${description} (${count})`)
    } catch (error) {
      succeeded = false
      console.error(`Daily job failed: ${description}`, error)
    }
  }
  return succeeded
}

/** Also runs the job now, since a stopped machine misses its time */
export const scheduleDailyJob = (): void => {
  void runDailyJob()
  const _job = new Cron(
    `0 2 * * *`,
    { timezone: ARIZONA_TIME_ZONE },
    () => void runDailyJob(),
  )
}

if (process.argv[1] === import.meta.filename) {
  const succeeded = await runDailyJob()
  await prisma.$disconnect()
  process.exitCode = succeeded ? 0 : 1
}
