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
    // React Router reads the route config at build time
    files: [`app/routes.ts`],
    rules: {
      'import/no-extraneous-dependencies': [`error`, { devDependencies: true }],
    },
  },
]
