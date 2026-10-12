import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default defineConfig({
  // React Router's plugin is left out, because Vitest renders components alone
  plugins: [tailwindcss()],
  resolve: viteConfig.resolve,
  test: {
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    projects: [
      {
        extends: true,
        test: {
          name: `node`,
          include: [`{app,server,test}/**/*.test.ts`],
          // Vitest stubs CSS imports by default, which empties `app.css?raw`
          css: { include: [/app\.css/u] },
          globalSetup: [`test/global-setup.ts`],
          setupFiles: [`test/setup.ts`],
          env: {
            APP_ENV: `test`,
            BETTER_AUTH_SECRET: `test-secret-that-is-at-least-32-characters`,
            BETTER_AUTH_URL: `http://localhost:3000`,
            EMAIL_TRANSPORT: `mailbox`,
            EMAIL_FROM: `MMMM <noreply@example.com>`,
            SUPPORT_EMAIL: `support@example.com`,
          },
        },
      },
      {
        extends: true,
        test: {
          name: `browser`,
          include: [`app/**/*.test.tsx`],
          setupFiles: [`test/browser-setup.ts`],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: `chromium` }],
          },
        },
      },
    ],
  },
})
