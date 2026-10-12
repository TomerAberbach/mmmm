import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: `e2e`,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    trace: `retain-on-failure`,
  },
  projects: [{ name: `chromium`, use: devices[`Desktop Chrome`] }],
  webServer: {
    command: `NODE_ENV=production node e2e/server.ts`,
    gracefulShutdown: { signal: `SIGTERM`, timeout: 5000 },
    url: BASE_URL,
    env: {
      PORT: String(PORT),
      BETTER_AUTH_SECRET: `e2e-secret-that-is-at-least-32-characters`,
      BETTER_AUTH_URL: BASE_URL,
      SUPPORT_EMAIL: `support@example.com`,
      APP_ENV: `test`,
      EMAIL_TRANSPORT: `mailbox`,
      EMAIL_FROM: `MMMM <noreply@example.com>`,
    },
  },
})
