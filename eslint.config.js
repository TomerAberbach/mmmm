import tomer from '@tomer/eslint-config'

export default [
  ...tomer,
  {
    settings: {
      // Neither Vitest browser mode nor Playwright uses Testing Library, so
      // their `page.getByRole` queries aren't Testing Library queries
      'testing-library/utils-module': `off`,
    },
  },
  {
    // React Router reads the route config at build time, and e2e/ holds only
    // Playwright tests and their helpers
    files: [`app/routes.ts`, `e2e/**`],
    rules: {
      'import/no-extraneous-dependencies': [`error`, { devDependencies: true }],
    },
  },
]
