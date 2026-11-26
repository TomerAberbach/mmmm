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
    // React Router reads the route config at build time, e2e/ holds only
    // Playwright tests and their helpers, and the deployed image leaves out
    // import/
    files: [`app/routes.ts`, `e2e/**`, `import/**`],
    rules: {
      'import/no-extraneous-dependencies': [`error`, { devDependencies: true }],
    },
  },
]
