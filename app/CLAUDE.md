# app

```
app
├── root.tsx          # Document layout, error boundary, and the middleware that loads the session
├── app.css           # Fonts and theme colors
├── routes.ts         # Route config
├── components/       # Shared UI built on React Aria Components
├── emails/           # Email bodies, named *.server.tsx
├── entry.server.tsx  # Renders with the CSP nonce
├── *.server.ts       # Server-only modules
└── generated/        # Prisma client, generated on install and by `pnpm db:reset`. Gitignored
```

## UI

- `app.css` removes Tailwind's default colors and fonts. Use the theme's: `ink`,
  `muted`, `accent`, `accent-strong`, `muted-light` and `accent-light` (only for
  large text), `accent-soft` and the bracket's round colors (only for
  decoration), `danger`, and `font-display`, `font-condensed`, `font-sans`
- Use Tailwind's scales, not arbitrary values such as `text-[13px]`. When a
  scale lacks a value, add it to the theme in `app.css`
- Build interactive controls on React Aria Components, as in
  `components/button.tsx`. Style a link as a button with `ButtonLink`
- Confirm destructive or hard-to-undo actions with `ConfirmDialog`. Its route
  action returns a `ConfirmResult`, and the dialog shows any `error`. Pass
  `onConfirm` instead for a change the page makes itself. Build any other modal
  dialog on `ModalFrame` from `components/modal-frame.tsx`
- Show an instant in the reader's time zone with `LocalTime` from
  `components/local-time.tsx`. Formatting it during the server render shows the
  server's time zone and fails hydration
- Mark controls and page chrome `print:hidden`, so data pages print cleanly
- Pages are `max-w-6xl` unless the route exports `handle = { fullWidth: true }`.
  Print a wide page with `page-landscape` and scale it with `print:zoom` from
  `app.css`, which reads the element's `--zoom`
- Give each page a `PageTitle`, which sets both its heading and its tab title,
  instead of a `meta` export

## Forms

- Validate forms with Conform and Zod 4. Import `parseWithZod` from
  `@conform-to/zod/v4`, since the default entry is for Zod 3
- Share a form's schema between the component and its action, and validate in
  the action too. Build fields from `TextField` and `PasswordField` in
  `components/text-field.tsx`, spreading `fieldProps(fields.<name>)`
- Set up a form with `useValidatedForm` from `components/use-validated-form.ts`,
  and answer a form the action refuses with `rejectForm` from
  `form-replies.server.ts`, which never sends a password back. Answer Better
  Auth's refusals, such as too many attempts, with `rejectAuthError`
- Put a field's error under its input, and a form's error below its submit
  button as a `FormError` from `components/form-error.tsx`, so nothing above
  them moves when they appear. Forms validate only once first submitted. A form
  too long to see at once also lists its field errors above it with
  `ErrorSummary` from `components/error-summary.tsx`
- Answer a form submitted through a fetcher with `acceptForm` from
  `form-replies.server.ts` once it saves, and show `SavedNotice` from
  `components/saved-notice.tsx`
- Convert and format dates with `dates.ts`. A `@db.Date` column holds midnight
  UTC, so read it in UTC. Show an instant as its day in Arizona with
  `formatArizonaDate`
- Check every free-text field that educators and players fill on the server with
  `serverFreeTextSchema` from `free-text.server.ts`, which adds the length limit
  and the offensive word filter. The browser bundle leaves the filter out, so a
  shared schema with such a field takes its text schema as a parameter, as
  `contestNameSchema` does. The action passes `serverFreeTextSchema`, and the
  component passes `freeTextSchema`. Admins' fields skip the filter, which flags
  some real combatants' names
- Open an editor in place, such as a rename, with `useInlineEdit` from
  `components/use-inline-edit.ts`, which closes it once the save succeeds

## Auth

- Read the signed-in educator with `await readSignedInEducator(context)` from
  `session.server.ts`. Root middleware looks up the session at most once per
  request, and only when something reads it
- Nest routes that need a signed-in educator under a layout route with the
  `requireSignedInEducator` middleware, as `routes/settings.tsx` does, and read
  the educator there with `readRequiredEducator` and the session with
  `readRequiredSession`
- Nest pages a signed-in educator shouldn't see, such as sign-in, under the
  `routes/signed-out.tsx` layout. A layout whose middleware must run on
  client-side navigation needs a loader, because React Router runs server
  middleware only for a request that calls one
- Root's loader data reaches every page, so it passes only what the header
  shows. Load an educator's address or ID in the route that needs it
- Add admin pages under the `routes/admin.second-factor.tsx` layout in
  `routes.ts`, which opens them only for a session whose `assurance` is
  `SECOND_FACTOR`. `requireAdmin` answers everyone but an admin with the
  not-found page
- `guardSecondFactorChange` in `second-factor.server.ts` checks every
  `/two-factor/*` and `/passkey/*` request. When adding a Better Auth endpoint
  that adds or removes a second factor, list it in `ADDING_PATHS` or
  `REMOVING_PATHS` there
- Better Auth copies a session's fields when it replaces the session, such as
  when an authenticator app turns on. Leave `assurance` without a Better Auth
  `defaultValue`, which would reset the copy to `PASSWORD`
- Send a signed-in educator to `href('/contests')`, and build absolute URLs,
  such as for emails and contest links, with `toAppUrl` from `env.server.ts`
- Count a request against several rate limits with `consumeAll` from
  `limits.server.ts`, which gives back the earlier limits' attempts when a later
  one refuses, and key per-IP limits on `readClientIp`
- Pass `headers: request.headers` to every `auth.api` call. The auth limits read
  the client's IP address from them, and throw without it
- Force request fields that no client may choose in `FORCED_FIELDS` in
  `auth.server.ts`, because `/api/auth/*` is public and skips the app's routes
- Educators can't sign in until they confirm their address, and confirming
  doesn't sign them in. Sign-up answers an existing address the same as a new
  one, so never show a different page or error for it

## Email

- Send email with `sendEmail` from `email.server.ts`, with a body built on
  `EmailLayout`, `EmailParagraph`, and `EmailAction` from
  `emails/layout.server.tsx`. Name email modules `*.server.tsx`
- `sendEmail` skips an address's emails past 10 an hour without failing, so a
  form can't flood an inbox. Send a security notice about a change already made
  with `sendNoticeOrLog`, which skips the cap and logs a failure instead of
  failing the request
- With `EMAIL_TRANSPORT=mailbox`, email stays in memory. Read it at
  `/dev/mailbox`, or with `readMailbox` in a test. Only `APP_ENV=development`
  and `APP_ENV=test` may use the mailbox

## Brackets

- Store or replace an unpublished bracket with `saveUnpublishedBracket` from
  `brackets.server.ts`, which writes every seed slot, battle, and the wild card
  in one transaction
- Read a year's phase with `readBracketSummary`, instead of checking
  `publishedAt`
- Only the current year takes new contests, players, and picks. Check a write
  that depends on whether a year is published or current inside its transaction
  with `lockYear` from `brackets.server.ts`, in `SHARE` mode, as `createPlayer`
  and the pick writes do, or with `lockYears` before reading the current year,
  as `createContest` does. Publishing and unpublishing take it in `UPDATE` mode,
  so neither interleaves with those writes. A transaction that also locks a
  player's row locks it first
- Read which seed slots or earlier battles feed a battle, and which Round 1
  battle the wild card's winner plays, from `bracket.ts`. `Battle` rows store no
  links, only a round and an index for results and picks to reference
- A `BracketInput` skips the wild card's seed in its division's list, so read
  each seed slot's combatant with `listSeedSlotNames` instead of indexing the
  list by seed. The setup form keeps one field per seed instead, so a name stays
  at its seed when the wild card moves. `bracket-form.ts` converts between the
  two
- Fill a battle's sides with `fillSides` from `seeded-bracket.ts`, which reads
  the seed slots, the wild card's entrants, and the winners so far from a
  `SeededBracket`. Build the `SeededBracket` once per input with
  `toSeededBracket`, and pass it to both `buildBracketView` and the pick rules
  in `picks.ts`
- Show a bracket from `buildBracketView` in `bracket-view.ts`. A regular
  `BattleBox` is hidden from screen readers and describes its battle in text for
  them. A diagram box adds no text, since the list of battles beside the diagram
  describes them. Inside a `PickingContext`, each box is a labeled control
  instead
- The diagram's boxes fit the year's longest name using the glyph widths in
  `name-width.ts`. Measure the glyphs again in Chromium after changing the font,
  weight, or tracking of names in `battle-box.tsx`
- The print zoom comes from `DIAGRAM_SIZE` in `bracket-diagram.tsx`. Measure the
  diagram again after changing its spacing or sizes. The browser tests fail when
  the diagram grows past the estimate, but not when it shrinks

## React Router

- Route modules import their types from `./+types/<route>.ts`, which
  `react-router typegen` generates. Run `pnpm typecheck` after adding a route
- Build every path to one of the app's routes with `href` from `react-router`,
  such as `href('/contests/:contestId', { contestId })`, so `pnpm typecheck`
  checks it against `routes.ts`
- Add stylesheets through root's `links` export with a `?url` import. A bare CSS
  import loads late in development on pages that match no route, such as a 404
- The content security policy allows only scripts with the request's nonce. Read
  it from `nonceContext` in `nonce.ts`

## Players

- Players have no accounts. The browser remembers one in a `player-<contestId>`
  cookie that holds their personal link's secret. Create link secrets with
  `createSecret` and store only `hashSecret`'s hash, from `secrets.server.ts`
- Nest the pages a player opens under `routes/play.tsx`, whose `loadPlayContest`
  middleware answers an unknown contest link with the not-found page. Require
  the remembered player with `requirePlayer` and read them with
  `readRequiredPlayer` from `play-context.server.ts`. It restarts the player's
  15 minutes on each response, so leave it off a page that asks who the player
  is, such as the contest link's "Continue as" prompt
- Change a player's picks with `pickWinner` from `picks.ts`, which also picks
  the winner's earlier wins and clears the later picks that no longer fit.
  `savePlayerDraft` and `submitPlayerPicks` refuse picks that `pickWinner`
  wouldn't produce
- A player edits a draft, and submitting copies it to their submission. Both are
  `Pick` rows, told apart by `stage`. Change them only through
  `player-picks.server.ts`, which locks the player's row so two requests can't
  interleave. Pass the year of the player's contest from `readPlayContest`
- Send the picker's requests through `usePicksRequests` in
  `components/picks-requests.ts`, which sends one at a time so the server
  applies them in order. React Router's fetchers cancel an earlier request in
  the browser, but the server still applies it

## Testing

- `*.test.ts` files run in Node, and `*.test.tsx` files run in Chromium through
  Vitest browser mode. Both are colocated with the code they test
- Node test files run in parallel against one database, and the current year is
  the newest published bracket's. Store each test's bracket under a year from
  `claimYear` in `test/years.ts`, which never returns the same year twice in a
  run. A test that needs the current year, such as to create a contest, runs
  inside `withCurrentYear` from the same file and adds its years there. It runs
  one such test at a time across files, in years newer than any `claimYear`
  returns. Create a contest or a player in a new current year with
  `createContestInNewYear` or `createPlayerInNewYear` from `test/contests.ts`,
  and educators with `createEducator` from `test/educators.ts`
- Browser tests load `app.css` and check accessibility, including contrast, with
  `expectNoAxeViolations` from `test/axe.ts`
- In browser tests, `toHaveTextContent` with a regex fails even on matching
  text. Pass the element's whole text
- Set a browser test's screen size with `page.viewport` from `vitest/browser`.
  Pages that switch layouts by breakpoint render every layout and hide the
  others with CSS, so scope queries to the visible one, such as
  `page.getByRole('tabpanel')`
