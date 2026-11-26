// Loads `.env`
import '../app/env.server.ts'

/** Also `[::1]`, as `URL` writes it */
const LOCAL_HOSTS = new Set([`localhost`, `127.0.0.1`, `[::1]`])

/** The only Fly app whose database may be emptied and seeded */
const DISPOSABLE_FLY_APP = `mmmm-staging`

/**
 * Throws unless the database holds only test data: staging's on Fly, and one on
 * this computer anywhere else. A terminal can still hold production's
 * `DATABASE_URL`
 */
export const requireDisposableDatabase = (
  env: NodeJS.ProcessEnv = process.env,
): void => {
  if (env.FLY_APP_NAME) {
    if (env.FLY_APP_NAME !== DISPOSABLE_FLY_APP) {
      throw new Error(`Refusing to change the database of ${env.FLY_APP_NAME}`)
    }
    return
  }
  if (!env.DATABASE_URL || !isLocal(env.DATABASE_URL)) {
    throw new Error(`Refusing to change a database on another computer`)
  }
}

const isLocal = (url: string): boolean =>
  URL.canParse(url) && LOCAL_HOSTS.has(new URL(url).hostname)
