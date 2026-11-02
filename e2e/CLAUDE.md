# e2e

- Tests run in Playwright against the production build. They set `APP_ENV=test`
  anyway, because only development and tests may use the mailbox. Read the email
  a test sent with `readEmails` and `readActionLink` from `mailbox.ts`
- Tests run in parallel, and each directory under `e2e/` gets its own server and
  database from `playwright.config.ts`, because a published bracket changes the
  current year for every test on its server. Put a test in `app/` unless it
  publishes or changes the bracket. Put a test that needs a published bracket in
  `contests/`, whose `setup.test.ts` publishes one first. A test that takes the
  bracket through other states goes in `bracket-lifecycle/`, whose tests run in
  order, or in a new directory with its own server and project. Turn off retries
  for such a project, because a retry starts from the state the failed attempt
  left
- The server's `ADMIN_LIST` comes from `admins.ts`, since a test can't change it
  once the server starts. Give each admin test its own address from that list
- Sign in as an admin with `signInAsAdmin` from `admins.ts`, which adds a
  passkey through Chromium's virtual authenticator. Test authenticator apps with
  `readTotpCode` from `test/totp.ts`
- Every test comes from one IP address, so a run gets 100 failed sign-ins every
  15 minutes, and 100 sign-ups, reset requests, and resends an hour, before the
  auth limits refuse it
