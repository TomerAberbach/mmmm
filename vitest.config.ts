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
        },
      },
      {
        extends: true,
        test: {
          name: `browser`,
          include: [`app/**/*.test.tsx`],
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
