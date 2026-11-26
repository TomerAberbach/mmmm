# Cutover

Replaces mmmm-old at `mmmm.onl` with this app. Every command runs in your own
terminal. Cutover starts an outage at step 1 of "Cut over" that ends when DNS
reaches the new app.

## Rehearse

Staging holds only seed data, which its next deploy restores.

1. Import a fresh dump of mmmm-old into an empty local database, as
   [operations.md](operations.md#import-mmmm-olds-data) says, and read the
   report
2. Deploy staging, sign up, start a bracket in the 2025 contest, submit it, and
   approve it
3. Run the Backup workflow and `scripts/restore-backup.sh`

## Create production

These steps leave mmmm-old as it is, so do them days ahead.

1. Have a lawyer review the pages at `/privacy`, `/terms`, and `/retention`, and
   listen to the main pages with a screen reader. Then remove the draft notice
   from `app/components/legal-page.tsx`
2. In Neon, create the project `mmmm-production` with Postgres 18 in AWS
   `us-east-1`, on the Launch plan, with database name `mmmm`
3. Run `fly apps create mmmm-production`, then set the secrets in
   [operations.md](operations.md#secrets) with `--app mmmm-production`, except
   `STAGING_PASSWORD`. Make a new `BETTER_AUTH_SECRET`, and a new Resend key
4. Deploy. The release command applies the migrations:

   ```sh
   fly deploy --config fly.production.toml --ha=false
   fly checks list --app mmmm-production
   ```

5. Delete `pnpm db:baseline`, since it would rewrite an applied migration
6. Set the `PRODUCTION_BACKUP_DATABASE_URL` secret and the `BACK_UP_PRODUCTION`
   variable on GitHub. Run the Backup workflow, then restore its dump with
   `scripts/restore-backup.sh production`
7. Check what mmmm-old serves now with `fly status --app mmmm` and
   `fly certs list --app mmmm`, and find its database. On 2026-11-26, both
   `mmmm.onl` and `www.mmmm.onl` answered with Cloudflare's error 525, a failed
   TLS handshake with the origin
8. For the rollback, record each Cloudflare record of `mmmm.onl` and
   `www.mmmm.onl`: its type, value, and whether it's proxied. A proxied record
   has no TTL to lower
9. Check that mmmm-old can start again. Run `fly releases --app mmmm` and
   confirm the last release succeeded. Its machines run from that image
10. Validate the new certificate ahead with the `_acme-challenge` record that
    Fly lists. If Fly refuses because mmmm-old holds the hostname, do it in step
    4 of "Cut over" instead:

    ```sh
    fly certs add mmmm.onl --app mmmm-production
    fly certs show mmmm.onl --app mmmm-production
    ```

11. In Cloudflare, under Rules, add a redirect from `www.mmmm.onl` to
    `https://mmmm.onl`, off until the cutover. The app accepts sign-ins only at
    the address in `BETTER_AUTH_URL`

## Cut over

1. Stop mmmm-old, so no write reaches it after the dump. Note the machine count
   that the first command prints:

   ```sh
   fly scale show --app mmmm
   fly scale count 0 --app mmmm
   ```

2. Dump its database with `pg_dump --format=custom`. Keep the dump encrypted
   until mmmm-old is deleted, since it holds names and password hashes
3. Import it into production with the steps in
   [operations.md](operations.md#import-mmmm-olds-data), the dry run first. Set
   `DATABASE_URL` to production's direct connection string. Compare the report's
   counts with mmmm-old's tables, and finish checking the import here. Then
   delete only the restored copy
4. If step 10 of "Create production" was refused, run
   `fly certs remove mmmm.onl --app mmmm`, then that step. Wait until
   `fly certs show` reports the certificate as issued
5. In Cloudflare, set the records that `fly certs show` lists, as DNS only, and
   turn on the `www` redirect. A proxied record would hide players' IP addresses
   from the rate limits. Once DNS moves, an imported educator can use Forgot
   password, and then the import can't rerun
6. Check `https://mmmm.onl/healthz`, sign up, and open a past year's leaderboard
7. Send the launch emails as
   [operations.md](operations.md#send-the-launch-emails) says

## Roll back

Before step 5 of "Cut over", only step 1 is needed, with step 3 if the
certificate moved, and nothing is lost. After it, a rollback loses what
educators and players did in the new app, so fix forward unless the app is
unusable.

1. Start mmmm-old with the count noted in step 1 of "Cut over", and check it
   with `fly status --app mmmm`:

   ```sh
   fly scale count 1 --app mmmm
   ```

2. Back up production with the Backup workflow
3. Move the certificate back to `mmmm`, if it moved
4. In Cloudflare, restore the recorded records, and turn off the `www` redirect

## Afterward

- Keep mmmm-old stopped for 30 days. Then delete the dump, its Fly app, and its
  database
- Raise production's machine in March, as [load-test.md](load-test.md) says
- Delete `pnpm db:import`, and inline `insertBracket`, which only the import
  uses
- Keep `pnpm launch:emails` and the files in `import/` that it uses until no
  educator waits, then delete them with the `launchEmailedAt` column and
  `app/emails/launch.server.tsx`
