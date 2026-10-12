import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default defineConfig({
  resolve: viteConfig.resolve,
  test: {
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: `node`,
          include: [`{app,server,test}/**/*.test.ts`],
          globalSetup: [`test/global-setup.ts`],
          setupFiles: [`test/setup.ts`],
          env: {
            BETTER_AUTH_SECRET: `test-secret-that-is-at-least-32-characters`,
            BETTER_AUTH_URL: `http://localhost:3000`,
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
