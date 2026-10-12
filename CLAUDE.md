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
├── server/             # Express middleware: security headers, cross-origin checks, rate limits, request logs
│   └── app.ts          # Hands requests to React Router with the request's CSP nonce
├── app/
│   ├── root.tsx        # Document layout and error boundary
│   ├── app.css         # Fonts and theme colors
│   ├── components/     # Shared UI built on React Aria Components
│   ├── routes/dev.*    # Development-only pages, which return 404 in production
│   ├── entry.server.tsx # Renders with the CSP nonce
│   ├── *.server.ts     # Server-only modules
│   └── generated/      # Prisma client, generated on install and by `pnpm db:reset`. Gitignored
├── prisma/             # Schema and seed
├── test/database.ts    # Creates a throwaway database for each Vitest and Playwright run
├── docs/operations.md  # Accounts, secrets, deploys, and backups
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
fly deploy --ha=false   # Deploy staging. See docs/operations.md

# Run one test file
pnpm test --run app/routes/home.test.tsx
pnpm test:e2e e2e/home.test.ts  # Builds first
```

Copy `.env.example` to `.env` before running the app, including `SUPPORT_EMAIL`,
which the footer links. Read variables with `requireEnv` from
`app/env.server.ts`, which loads `.env` and fails with a message naming the
missing variable.

## Database

- There are no migrations until cutover. Edit `prisma/schema.prisma` in place
  and run `pnpm db:reset`
- Prisma refuses `prisma db push --force-reset`, which `pnpm db:reset` runs,
  when an AI agent runs it. Ask the user before running `pnpm db:reset`, then
  pass their reply as `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`

## UI

- `app/app.css` removes Tailwind's default colors and fonts. Use the theme's:
  `ink`, `muted`, `accent`, `accent-strong`, `muted-light` and `accent-light`
  (only for large text), `accent-soft` (only for decoration), `danger`, and
  `font-display`, `font-condensed`, `font-sans`
- Use Tailwind's scales, not arbitrary values such as `text-[13px]`. When a
  scale lacks a value, add it to the theme in `app/app.css`
- Build interactive controls on React Aria Components, as in
  `app/components/button.tsx`
- Confirm destructive or hard-to-undo actions with `ConfirmDialog`. Its action
  returns a `ConfirmResult`, and the dialog shows any `error`
- Mark controls and page chrome `print:hidden`, so data pages print cleanly
- Give each page a `PageTitle`, which sets both its heading and its tab title,
  instead of a `meta` export
- Delete a `routes/dev.*` page in the commit that first uses its component on a
  real page

## Email

- Send email with `sendEmail` from `app/email.server.ts`, with a body built on
  `EmailLayout`, `EmailParagraph`, and `EmailAction` from
  `app/emails/layout.server.tsx`. Name email modules `*.server.tsx`
- With `EMAIL_TRANSPORT=mailbox`, as in development and tests, email stays in
  memory. Read it at `/dev/mailbox`, or with `readMailbox` in a test

## Security

- Never store or log client IP addresses. Rate limits keep them in memory only
- Add request middleware after the `/healthz` route in `server.ts`, so Fly.io's
  health checks skip it. Static assets skip it too
- Staging (`APP_ENV=staging`) asks every request for `STAGING_PASSWORD`, and
  refuses to start without it, so seeded accounts can use `password`
- Never ask for or handle secret values. Give the user a command to set them
  from their own terminal, as `docs/operations.md` does
- Logs drop query strings. Add each path segment that holds a secret to
  `SECRET_PATH` in `server/logging.ts`
- The content security policy allows only scripts with the request's nonce. Read
  it from `nonceContext` in `app/nonce.ts`
- `pnpm dev` runs Node with `--conditions=development`, so Node and Vite load
  the same copy of `react-router`. Without it, `getLoadContext` fails

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
- Browser tests load `app/app.css` and check accessibility, including contrast,
  with `expectNoAxeViolations` from `test/axe.ts`
- `e2e/*.test.ts` files run in Playwright against the production build
