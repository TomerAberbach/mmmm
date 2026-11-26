import { parseArgs } from 'node:util'
import { prisma } from '../app/db.server.ts'
import {
  checkEmailSettings,
  readEmailTransport,
} from '../app/email-settings.server.ts'
import { isServedOverHttps } from '../app/env.server.ts'
import { countWaiting, sendLaunchEmails } from './launch-emails.ts'

/** Resend allows 2 requests a second, and 100 emails a day on its free plan */
const PAUSE_MS = 600
const DEFAULT_LIMIT = `100`

/**
 * Sends the launch emails, up to `--limit`. `--dry-run` only counts who is
 * waiting for one
 */
const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: `boolean`, default: false },
      limit: { type: `string`, default: DEFAULT_LIMIT },
    },
  })
  const limit = Number(values.limit)
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error(`--limit takes a whole number from 1`)
  }
  const waiting = await countWaiting()
  if (values[`dry-run`]) {
    console.log(`${waiting} educators are waiting for the launch email`)
    return
  }
  checkSettings()
  const { sent, failures } = await sendLaunchEmails({
    limit,
    pauseMs: PAUSE_MS,
  })
  for (const { educatorId, error } of failures) {
    console.error(`Failed to email educator ${educatorId}`, error)
  }
  console.log(
    `Sent ${sent} launch emails. ${waiting - sent} educators are left`,
  )
}

/** Development's settings would mark educators as emailed and send nothing */
const checkSettings = (): void => {
  checkEmailSettings()
  if (readEmailTransport() !== `resend`) {
    throw new Error(`Set EMAIL_TRANSPORT to resend`)
  }
  if (!isServedOverHttps()) {
    throw new Error(`Set BETTER_AUTH_URL to the app's https URL`)
  }
}

try {
  await main()
} finally {
  await prisma.$disconnect()
}
