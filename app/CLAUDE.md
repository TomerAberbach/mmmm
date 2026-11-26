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
  `onConfirm` instead for a change the page makes itself, and `isOpen` and
  `onOpenChange` instead of `trigger` to open it from a menu. Build any other
  modal dialog on `ModalFrame` from `components/modal-frame.tsx`
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
  Auth's refusals with `rejectAuthError` from `auth-replies.server.ts`. Refuse a
  Better Auth request with `refuse` from `app-refusal.server.ts`, whose message
  educators see
- Put a field's error under its input, and a form's error below its submit
  button as a `FormError` from `components/form-error.tsx`, so nothing above
  them moves when they appear. Forms validate only once first submitted. A form
  too long to see at once also lists its field errors above it with
  `ErrorSummary` from `components/error-summary.tsx`
- Give a route with only an action a loader that redirects to the page that
  posts to it, since a GET would otherwise answer with a raw error
- Answer a form submitted through a fetcher with `saveForm` from
  `form-replies.server.ts`, or with `acceptForm` and `rejectForm` when the reply
  sets headers or Better Auth can refuse it, and show `SavedNotice` from
  `components/saved-notice.tsx`
- Write apostrophes as ’ in copy, and end an error without a period
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
  `SECOND_FACTOR`. It alone picks whether another session sets up or verifies a
  second factor, so redirect to `/admin`. `requireAdmin` answers everyone but an
  admin with the not-found page
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
  `auth.server.ts`, because `/api/auth/*` is public and skips the app's routes.
  Sign-up refuses a field missing from `SIGN_UP_SCHEMA` there
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

## Organizations

- An educator joins their email domain's organization at sign-in, with
  `joinOrganization`, so a new way to confirm an address needs no step of its
  own. Add a free email provider that `free-email-domains` lacks to
  `organizations.server.ts`. The package's install script only refetches its
  list, so `allowBuilds` denies it

- A contest page under `routes/contests.contest.tsx` also opens for a colleague
  the contest is shared with. Read the contest with `readRequiredContest` unless
  a colleague may see the page, then with `readViewableContest`, which leaves
  out the contest link

## Brackets

- Store or replace an unpublished bracket with `saveUnpublishedBracket` from
  `brackets.server.ts`, which writes every seed slot, battle, and the wild card
  in one transaction
- Read a year's phase with `readBracketSummary`, and the years the admin manages
  with `readAdminYears`, instead of checking `publishedAt`, `lockedAt`, or the
  date. The admin sets up the next year only once the current year has a
  champion
- Only an open year, current and not locked, takes new contests, players, and
  picks. Run a transaction that depends on it with `withCurrentYear` from
  `brackets.server.ts`, and check it with `isOpen`. Such writes share one lock,
  which publishing, results, renames, and moves take alone with
  `withCurrentYearAlone`, so none interleaves with them.
  `saveUnpublishedBracket` shares it and takes a lock on its year, so saves of
  different years and pick writes run alongside it
- Post the year an admin page shows with each of its forms, and refuse another
  one, since the years the admin manages move on with results
- Change results only through `results.server.ts`. A request holds what the
  admin saw and confirmed, and `saveResult` refuses it when its effects would
  differ. The rules both sides share are in `results.ts`
- A merge's winner is its own `Combatant` row, whose members are the two sides.
  It lasts only while its result does, so results store and remove merges with
  `replaceResults`. Compare a side with a winner through `didAdvance`, since the
  winner may be a merge of the side
- Move combatants in a published bracket with `moveCombatants`, which clears the
  picks and results that `listDisturbedBattles` names. Send `readArrangement`
  with a write that depends on who meets in a battle, and refuse another one
- Decide which picks are right only in `listRightWinners` in `scoring.ts`. The
  marks, from `buildMarkedBracketView`, and the stored scores, from
  `storeScores`, both read it. Rank by score in the query that lists
  submissions, since approving, rejecting, and deleting change ranks but not
  scores
- Read which seed slots or earlier battles feed a battle, and which Round 1
  battle the wild card's winner plays, from `bracket.ts`. `Battle` rows store no
  links, only a round and an index for results and picks to reference
- A `BracketInput` skips the wild card's seed in its division's list, so read
  each seed slot's combatant with `listSeedSlots` or `listDivisionSeedSlots`
  instead of indexing the list by seed. The setup form keeps one field per seed
  instead, so a name stays at its seed when the wild card moves.
  `bracket-form.ts` converts between the two, and shows the problems
  `listNameProblems` finds at the fields for their places, so add a bracket rule
  only to `bracket-input.ts`. Stored brackets skip the name rules, so a new one
  can't make a past year unreadable
- Key winners and picks by combatant ID, and show names only for display, so a
  rename leaves saved picks as they were. A `BracketInput` and the setup form
  hold names, because combatants have no IDs until the bracket is saved
- Fill a battle's sides with `fillSides` from `seeded-bracket.ts`, which reads
  the seed slots, the wild card's entrants, and the winners so far from a
  `SeededBracket`. Build the `SeededBracket` once per `StoredBracket` with
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
- Nest only what a contest link opens under `routes/play.tsx`, and a player's
  own pages under `routes/player.tsx`, whose addresses hold the contest's ID. A
  player who keeps their personal link after the contest link is replaced must
  never see the new one, so give a player a contest link only from
  `readPersonalLink`'s `startLinkSecret`. Nest a page for the remembered player
  under `routes/player.remembered.tsx`, and read them with `readRequiredPlayer`
  from `play-context.server.ts`. The layout restarts the player's 15 minutes on
  each response, so leave it off a page that asks who the player is, such as the
  contest link's "Continue as" prompt
- Read leaderboards and the brackets their rows open from
  `leaderboards.server.ts`, which hides names by viewer on the server and
  returns nothing while the year is open. Nest a player's leaderboard pages
  under `routes/player.approved.tsx`
- Give a new leaderboard or contest page a `ReportDialog`, and answer it with
  `answerReport`, which checks that the reporter sees what they report
- Change a player's picks with `pickWinner` from `picks.ts`, which also picks
  the winner's earlier wins and clears the later picks that no longer fit.
  `savePlayerDraft` and `submitPlayerPicks` refuse picks that `pickWinner`
  wouldn't produce, including a combatant ID from another year's bracket
- A player edits a draft, and submitting copies it to their submission. Both are
  `Pick` rows, told apart by `stage`. Change them only through
  `player-picks.server.ts`, which locks the player's row so two requests can't
  interleave
- Approve, reject, and rename a contest's players only through
  `contest-players.server.ts`, whose writes match a player by its contest and
  the signed-in educator's ID, so another educator's request changes nothing
- Deleting a contest or player sets `deletedAt`, which moves it to the trash.
  Filter each query of either with `CONTEST_OUTSIDE_TRASH`,
  `PLAYER_OUTSIDE_TRASH`, or `educatorPlayers` from `outside-trash.server.ts`,
  unless it reads the trash, and recheck `deletedAt` inside a transaction that
  adds to them. Delete, restore, and erase only through `trash.server.ts`
- Answer a link that can work again, such as a deleted player's, with a 404.
  Chromium caches a 410 forever
- Send the picker's requests and results through `useRequestQueue` in
  `components/request-queue.ts`, which sends one at a time so the server applies
  them in order. A 423 means submissions closed. React Router's fetchers cancel
  an earlier request in the browser, but the server still applies it

## Testing

- Render a component that needs a router with `renderRoutes` from
  `test/render-routes.tsx`
- `*.test.ts` files run in Node, and `*.test.tsx` files run in Chromium through
  Vitest browser mode. Both are colocated with the code they test
- Each Vitest worker has its own database, and runs its Node test files one
  after another. The current year is the newest published bracket's. Store each
  bracket with `addYear` from `test/years.ts`, or under a year from `claimYear`,
  which returns a newer year on each call, so a test's newest published year is
  current until the test ends. Create a contest or a player in a new current
  year with `createContestInNewYear` or `createPlayerInNewYear` from
  `test/contests.ts`, a submission with a status and no picks with
  `addSubmission`, and educators with `createEducator` from `test/educators.ts`
- Browser tests load `app.css` and check accessibility, including contrast, with
  `expectNoAxeViolations` from `test/axe.ts`
- In browser tests, `toHaveTextContent` with a regex fails even on matching
  text. Pass the element's whole text
- Set a browser test's screen size with `page.viewport` from `vitest/browser`.
  Pages that switch layouts by breakpoint render every layout and hide the
  others with CSS, so scope queries to the visible one, such as
  `page.getByRole('tabpanel')`
