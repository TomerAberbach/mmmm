# e2e

- Tests run in Playwright against the production build. They set `APP_ENV=test`
  anyway, because only development and tests may use the mailbox. Read the email
  a test sent with `readEmails` and `readActionLink` from `mailbox.ts`
- The server's `ADMIN_LIST` comes from `admins.ts`, since a test can't change it
  once the server starts. Give each admin test its own address from that list
- Test passkeys with Chromium's virtual authenticator, as
  `addVirtualAuthenticator` in `admins.test.ts` does, and authenticator apps
  with `readTotpCode` from `test/totp.ts`
- Every test comes from one IP address, so a run gets 100 failed sign-ins every
  15 minutes, and 100 sign-ups, reset requests, and resends an hour, before the
  auth limits refuse it
