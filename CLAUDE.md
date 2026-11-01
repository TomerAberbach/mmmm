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
├── server.ts           # Express entry point: middleware order, then Vite in development or the build in production
├── server/             # Express middleware: security headers, cross-origin checks, rate limits, the client's IP address, request logs. Has its own CLAUDE.md
├── app/                # The React Router app. Has its own CLAUDE.md
├── prisma/             # Schema and seed. Has its own CLAUDE.md
├── test/database.ts    # Creates a throwaway database for each Vitest and Playwright run
├── docs/operations.md  # Accounts, secrets, deploys, backups, and admins
└── e2e/                # Playwright tests against the production build. Has its own CLAUDE.md
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
fly deploy --ha=false   # Deploy staging. See docs/operations.md

# Run one test file
pnpm test --run app/components/signed-out-home.test.tsx
pnpm test:e2e e2e/home.test.ts  # Builds first
```

CI runs each script that `pnpm check` runs, `check:static`, `check:test`, and
`test:e2e`, as its own parallel job. Add a new check to one of them, or add its
script to both `check` and the matrix in `.github/workflows/ci.yml`.

After a dependency changes, hard-reload the dev app (Cmd+Shift+R). The browser
keeps Vite's old prebundled chunks, so the page loads two copies of React and
never hydrates.

`pnpm dev` runs Node with `--conditions=development`, so Node and Vite load the
same copy of `react-router`. Without it, `getLoadContext` fails.

Copy `.env.example` to `.env` before running the app, including `SUPPORT_EMAIL`,
which the footer links. Read variables with `requireEnv` from
`app/env.server.ts`, which loads `.env` and fails with a message naming the
missing variable.

## Database

- Prisma refuses `prisma db push --force-reset`, which `pnpm db:reset` runs,
  when an AI agent runs it. Ask the user before running `pnpm db:reset`, then
  pass their reply as `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`

## Security

- Never store or log client IP addresses. Rate limits keep them in memory only
- Read the client's IP address from the `CLIENT_IP_HEADER` that
  `server/client-ip.ts` sets, never from `X-Forwarded-For`, which clients can
  forge. The auth limits in `app/auth-limits.server.ts` key on it
- Add request middleware after the `/healthz` route in `server.ts`, so Fly.io's
  health checks skip it. Static assets skip it too
- Staging (`APP_ENV=staging`) asks every request for `STAGING_PASSWORD`, and
  refuses to start without it, so seeded educators can use `password`
- Never ask for or handle secret values. Give the user a command to set them
  from their own terminal, as `docs/operations.md` does

## Conventions

- Use the terms in `glossary.md` exactly in identifiers, tests, docs, and commit
  descriptions. UI copy may use everyday phrasing, as the glossary describes
- Enforce every rule on the server. Hiding a control never replaces a check
- Use `jj`, not `git`

## Testing

- `*.test.ts` files under `server/` and `test/` run in Node, colocated with the
  code they test
