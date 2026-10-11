import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default defineConfig({
  resolve: viteConfig.resolve,
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: `node`,
          include: [`{app,server,test}/**/*.test.ts`],
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
