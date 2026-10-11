# mmmm

March Mammal Madness Manager: a web app for educators to run
[March Mammal Madness](https://libguides.asu.edu/marchmammalmadness) bracket
contests with their players.

## Planning docs

- [Rewrite proposal](https://claude.ai/artifact/11vAR3UMQiCRZDxCMavDh7): what
  the app does
- [Technology decisions](https://claude.ai/artifact/7snLfTbRNWHYRr2T32Tsyk)
- [Implementation plan](https://claude.ai/artifact/2MFiUNd8TNGDYm3ut8sks9): the
  commit-by-commit plan and the workflow for each commit

Read these with the Claude Docs connector, not by fetching the URLs.

## Project structure

```
mmmm
├── server.ts           # Express entry point. Serves Vite in development and the build in production
├── server/app.ts       # Express app that hands requests to React Router
├── app/
│   ├── root.tsx        # Document layout and error boundary
│   ├── *.server.ts     # Server-only modules
│   └── generated/      # Prisma client, generated on install and by `pnpm db:reset`. Gitignored
├── prisma/             # Schema and seed
├── test/database.ts    # Creates a throwaway database for each Vitest and Playwright run
└── e2e/                # Playwright tests against the production build
```

## Development

```sh
# Everything CI runs. Run before handing work back
pnpm check

docker compose up -d  # Start Postgres. The app and tests need it

pnpm dev        # Start the app on http://localhost:3000
pnpm start      # Serve the build
pnpm typecheck  # Generate route types, then run tsc
pnpm knip       # Find unused files, dependencies, and exports
pnpm db:reset   # Push the schema to an empty database, regenerate the client, and reseed
pnpm db:seed

# Run one test file
pnpm test --run app/routes/home.test.tsx
pnpm test:e2e e2e/home.test.ts  # Builds first
```

Copy `.env.example` to `.env` before running the app. Read variables with
`requireEnv` from `app/env.server.ts`, which loads `.env` and fails with a
message naming the missing variable.

## Database

- There are no migrations until cutover. Edit `prisma/schema.prisma` in place
  and run `pnpm db:reset`
- Prisma refuses `prisma db push --force-reset`, which `pnpm db:reset` runs,
  when an AI agent runs it. Ask the user before running `pnpm db:reset`, then
  pass their reply as `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`

## React Router

- Route modules import their types from `./+types/<route>.ts`, which
  `react-router typegen` generates. Run `pnpm typecheck` after adding a route
- Add stylesheets through root's `links` export with a `?url` import. A bare CSS
  import loads late in development on pages that match no route, such as a 404

## Conventions

- Use the terms in `glossary.md` exactly in identifiers, tests, docs, and commit
  descriptions. UI copy may use everyday phrasing, as the glossary describes
- Enforce every rule on the server. Hiding a control never replaces a check
- Use `jj`, not `git`

## Testing

- `*.test.ts` files under `app/`, `server/`, and `test/` run in Node, and
  `app/**/*.test.tsx` files run in Chromium through Vitest browser mode. Both
  are colocated with the code they test
- Browser tests check accessibility with `expectNoAxeViolations` from
  `test/axe.ts`
- `e2e/*.test.ts` files run in Playwright against the production build
