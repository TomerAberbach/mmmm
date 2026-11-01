import { defineConfig, devices } from '@playwright/test'
import { ADMIN_LIST } from './e2e/admins.ts'

// The upcoming year's bracket is shared by every test on a server, so tests
// that publish or change it run on a server and database of their own. Each
// server runs the tests in one directory under `e2e/`
const SERVERS = {
  app: 3100,
  bracketLifecycle: 3101,
  contests: 3102,
}

const toBaseUrl = (port: number): string => `http://localhost:${port}`

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  fullyParallel: true,
  // CI's runner runs only these tests, so they can use every core, while the
  // default of half leaves room for other work locally
  workers: process.env.CI ? `100%` : undefined,
  use: { ...devices[`Desktop Chrome`], trace: `retain-on-failure` },
  projects: [
    {
      name: `app`,
      testDir: `e2e/app`,
      use: { baseURL: toBaseUrl(SERVERS.app) },
    },
    {
      name: `bracket lifecycle`,
      testDir: `e2e/bracket-lifecycle`,
      // A retry starts over from the first test, which the earlier attempt's
      // bracket breaks
      retries: 0,
      use: { baseURL: toBaseUrl(SERVERS.bracketLifecycle) },
    },
    {
      name: `contests setup`,
      testDir: `e2e/contests`,
      testMatch: `setup.test.ts`,
      retries: 0,
      use: { baseURL: toBaseUrl(SERVERS.contests) },
    },
    {
      name: `contests`,
      testDir: `e2e/contests`,
      testIgnore: `setup.test.ts`,
      dependencies: [`contests setup`],
      use: { baseURL: toBaseUrl(SERVERS.contests) },
    },
  ],
  webServer: Object.values(SERVERS).map(port => ({
    command: `NODE_ENV=production node e2e/server.ts`,
    gracefulShutdown: { signal: `SIGTERM`, timeout: 5000 },
    url: toBaseUrl(port),
    env: {
      PORT: String(port),
      BETTER_AUTH_SECRET: `e2e-secret-that-is-at-least-32-characters`,
      BETTER_AUTH_URL: toBaseUrl(port),
      SUPPORT_EMAIL: `support@example.com`,
      APP_ENV: `test`,
      ADMIN_LIST: ADMIN_LIST.join(`,`),
      EMAIL_TRANSPORT: `mailbox`,
      EMAIL_FROM: `MMMM <noreply@example.com>`,
    },
  })),
})
