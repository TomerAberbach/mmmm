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
├── server/             # Express middleware: security headers, cross-origin checks, rate limits, the client's IP address, request logs
│   └── app.ts          # Hands requests to React Router with the request's CSP nonce
├── app/
│   ├── root.tsx        # Document layout and error boundary
│   ├── app.css         # Fonts and theme colors
│   ├── components/     # Shared UI built on React Aria Components
│   ├── entry.server.tsx # Renders with the CSP nonce
│   ├── *.server.ts     # Server-only modules
│   └── generated/      # Prisma client, generated on install and by `pnpm db:reset`. Gitignored
├── prisma/             # Schema and seed
├── test/database.ts    # Creates a throwaway database for each Vitest and Playwright run
├── docs/operations.md  # Accounts, secrets, deploys, backups, and admins
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
pnpm test --run app/components/signed-out-home.test.tsx
pnpm test:e2e e2e/home.test.ts  # Builds first
```

After a dependency changes, hard-reload the dev app (Cmd+Shift+R). The browser
keeps Vite's old prebundled chunks, so the page loads two copies of React and
never hydrates.

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
  `app/components/button.tsx`. Style a link as a button with `ButtonLink`
- Confirm destructive or hard-to-undo actions with `ConfirmDialog`. Its action
  returns a `ConfirmResult`, and the dialog shows any `error`
- Mark controls and page chrome `print:hidden`, so data pages print cleanly
- Give each page a `PageTitle`, which sets both its heading and its tab title,
  instead of a `meta` export
- Delete a `routes/dev.*` page in the commit that first uses its component on a
  real page

## Forms

- Validate forms with Conform and Zod 4. Import `parseWithZod` from
  `@conform-to/zod/v4`, since the default entry is for Zod 3
- Share a form's schema between the component and its action, and validate in
  the action too. Build fields from `TextField` and `PasswordField` in
  `app/components/text-field.tsx`, spreading `fieldProps(fields.<name>)`
- Set up a form with `useValidatedForm` from
  `app/components/use-validated-form.ts`, and answer a failed submission with
  `rejectSubmission` from `app/reject-submission.server.ts`, which never sends a
  password back. Answer Better Auth's refusals, such as too many attempts, with
  `rejectAuthError`
- Put a field's error under its input, and a form's error below its submit
  button as a `FormError` from `app/components/form-error.tsx`, so nothing above
  them moves when they appear. Forms validate only once first submitted
- Check every free-text field on the server with `serverFreeTextSchema` from
  `app/free-text.server.ts`, which adds the length limit and the offensive word
  filter. The browser bundle leaves the filter out

## Auth

- Read the signed-in educator with `await readSignedInEducator(context)` from
  `app/session.server.ts`. Root middleware looks up the session at most once per
  request, and only when something reads it
- Nest routes that need a signed-in educator under a layout route with the
  `requireSignedInEducator` middleware, as `app/routes/settings.tsx` does, and
  read the educator there with `readRequiredEducator` and the session with
  `readRequiredSession`
- Root's loader data reaches every page, so it passes only what the header
  shows. Load an educator's address or ID in the route that needs it
- Add admin pages under the `routes/admin.second-factor.tsx` layout in
  `app/routes.ts`, which opens them only for a session whose `assurance` is
  `SECOND_FACTOR`. `requireAdmin` answers everyone but an admin with the
  not-found page
- `guardSecondFactorChange` in `app/second-factor.server.ts` checks every
  `/two-factor/*` and `/passkey/*` request. When adding a Better Auth endpoint
  that adds or removes a second factor, list it in `ADDING_PATHS` or
  `REMOVING_PATHS` there
- Better Auth copies a session's fields when it replaces the session, such as
  when an authenticator app turns on. Leave `assurance` without a Better Auth
  `defaultValue`, which would reset the copy to `PASSWORD`
- Pass `headers: request.headers` to every `auth.api` call. The auth limits read
  the client's IP address from them, and throw without it
- Force request fields that no client may choose in `FORCED_FIELDS` in
  `app/auth.server.ts`, because `/api/auth/*` is public and skips the app's
  routes
- Educators can't sign in until they confirm their address, and confirming
  doesn't sign them in. Sign-up answers an existing address the same as a new
  one, so never show a different page or error for it

## Email

- Send email with `sendEmail` from `app/email.server.ts`, with a body built on
  `EmailLayout`, `EmailParagraph`, and `EmailAction` from
  `app/emails/layout.server.tsx`. Name email modules `*.server.tsx`
- `sendEmail` skips an address's emails past 10 an hour without failing, so a
  form can't flood an inbox. Send a security notice about a change already made
  with `sendNoticeOrLog`, which skips the cap and logs a failure instead of
  failing the request
- With `EMAIL_TRANSPORT=mailbox`, email stays in memory. Read it at
  `/dev/mailbox`, or with `readMailbox` in a test. Only `APP_ENV=development`
  and `APP_ENV=test` may use the mailbox, so the end-to-end tests set
  `APP_ENV=test` even though they run the production build

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
- Logs drop query strings. Add each path segment that holds a secret to
  `SECRET_PATH` in `server/logging.ts`
- The content security policy allows only scripts with the request's nonce. Read
  it from `nonceContext` in `app/nonce.ts`
- The policy blocks `<style>` elements, except ones whose hash `styleSrc` in
  `server/security.ts` lists, such as React Aria's pressable style. When a React
  Aria upgrade fails `e2e/security.test.ts` with a blocked inline style, update
  the hash from the error
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
- `e2e/*.test.ts` files run in Playwright against the production build. Read the
  email a test sent with `readEmails` and `readActionLink` from `e2e/mailbox.ts`
- The end-to-end server's `ADMIN_LIST` comes from `e2e/admins.ts`, since a test
  can't change it once the server starts. Give each admin test its own address
  from that list
- Test passkeys with Chromium's virtual authenticator, as
  `addVirtualAuthenticator` in `e2e/admins.test.ts` does, and authenticator apps
  with `readTotpCode` from `test/totp.ts`
- In browser tests, `toHaveTextContent` with a regex fails even on matching
  text. Pass the element's whole text
- End-to-end tests all come from one IP address, so a run gets 100 failed
  sign-ins every 15 minutes, and 100 sign-ups, reset requests, and resends an
  hour, before the auth limits refuse it
