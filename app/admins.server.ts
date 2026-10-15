import { normalizeEmail } from './limits.server.ts'

// Read on each check, so a test can change the list. A deploy that changes
// `ADMIN_LIST` restarts the app anyway
const readAdminList = (): Set<string> =>
  new Set(
    (process.env.ADMIN_LIST ?? ``)
      .split(`,`)
      .map(normalizeEmail)
      .filter(email => email !== ``),
  )

// Taking an address off the list makes its educator a regular educator at
// once, whatever second factors they set up
export const isAdmin = (educator: {
  email: string
  emailVerified: boolean
}): boolean =>
  educator.emailVerified && readAdminList().has(normalizeEmail(educator.email))
