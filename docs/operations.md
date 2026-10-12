# Operations

How staging is set up, deployed, and backed up. Production follows the same
shape at cutover.

## Accounts

| Service        | What it holds                                         | Where to manage it                                                                 |
| -------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Fly.io         | The `mmmm-staging` app, in region `iad`               | [fly.io/apps/mmmm-staging](https://fly.io/apps/mmmm-staging)                       |
| Neon           | The `mmmm-staging` project, Postgres 18, `us-east-1`  | [console.neon.tech](https://console.neon.tech/app/projects)                        |
| Tigris         | The `mmmm-backups` bucket, billed through Fly         | `fly storage dashboard mmmm-backups`                                               |
| GitHub Actions | CI and the nightly backup                             | [Actions settings](https://github.com/TomerAberbach/mmmm/settings/secrets/actions) |
| Resend         | Sends email from `send.mmmm.onl`                      | [resend.com/domains](https://resend.com/domains)                                   |
| Cloudflare     | DNS for `mmmm.onl`, and forwarding `support@mmmm.onl` | [dash.cloudflare.com](https://dash.cloudflare.com)                                 |
| Namecheap      | Registers `mmmm.onl`                                  | [Domain list](https://ap.www.namecheap.com/domains/list/)                          |

## Secrets

Set secrets from your own terminal, never in a chat or a commit. To keep a value
out of shell history, run `fly secrets import --app mmmm-staging --stage`, paste
`NAME=value` lines, and press Ctrl-D. `gh secret set NAME` prompts for its
value.

### Fly (`fly secrets list --app mmmm-staging`)

| Secret               | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Neon's pooled connection string                                                  |
| `BETTER_AUTH_SECRET` | Random. Set with `fly secrets set BETTER_AUTH_SECRET=$(openssl rand -base64 32)` |
| `STAGING_PASSWORD`   | The password testers enter in the browser. Any username works                    |
| `RESEND_API_KEY`     | A Resend API key with sending access                                             |
| `SUPPORT_EMAIL`      | `support@mmmm.onl`, which Cloudflare forwards                                    |

`fly.toml` sets `APP_ENV`, `BETTER_AUTH_URL`, `EMAIL_TRANSPORT`, and
`EMAIL_FROM`, which aren't secret. With `APP_ENV=staging`, the app refuses to
start without `STAGING_PASSWORD`. Static assets load without the password, since
production serves the same files.

### GitHub (repository settings, Secrets and variables, Actions)

| Name                           | Kind     | Value                                           |
| ------------------------------ | -------- | ----------------------------------------------- |
| `STAGING_BACKUP_DATABASE_URL`  | Secret   | Neon's direct (unpooled) connection string      |
| `BACKUP_AWS_ACCESS_KEY_ID`     | Secret   | The Tigris access key from `fly storage create` |
| `BACKUP_AWS_SECRET_ACCESS_KEY` | Secret   | Its secret                                      |
| `BACKUP_BUCKET`                | Variable | `mmmm-backups`                                  |
| `BACKUP_AGE_RECIPIENT`         | Variable | The age public key, starting `age1`             |

### Password manager

- The age identity, `mmmm-backup.key`, which decrypts backups. The password
  manager keeps the only copy
- `STAGING_PASSWORD`, to give testers

## Deploying staging

```sh
fly deploy --ha=false
```

`--ha=false` keeps one machine, because rate limits are stored in memory. A
stopped machine forgets every count, so the production app must also set
`min_machines_running = 1`. Staging can stop when idle, since its password keeps
strangers out. Each release empties the database, pushes the schema, and seeds
it, so staging starts from fresh data. The seed creates `educator@example.com`
with the password `password`.

The machine stops when idle and starts on the next request. `/healthz` reports
whether the database answers, and it skips the staging password.

## Email

`EMAIL_TRANSPORT` selects where email goes. Staging sets `resend`, so email goes
out from `noreply@send.mmmm.onl`. Development and tests set `mailbox`, which
keeps sent email in memory at `/dev/mailbox`. The app refuses the mailbox unless
`APP_ENV` is `development` or `test`, because the mailbox shows every email
without signing in. Set `APP_ENV=production` on the production app. To check
delivery on staging, sign up there with your own address.

## Backups

`.github/workflows/backup.yml` runs at 08:00 UTC each night and on demand from
the Actions tab. It runs `pg_dump` from the `postgres:18` image, encrypts the
dump with age to `BACKUP_AGE_RECIPIENT`, and uploads it to
`s3://mmmm-backups/staging/`. A lifecycle rule on the bucket deletes dumps after
30 days. The workflow never holds the key that decrypts them.

GitHub emails you when a run fails.

### Restoring

```sh
docker compose up -d
AGE_IDENTITY_FILE=mmmm-backup.key BACKUP_BUCKET=mmmm-backups \
  AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… \
  scripts/restore-backup.sh
```

The script restores the newest dump into a new database on the local Postgres
and prints how many educators it holds. Save the identity from the password
manager to a file first, and delete the file afterward.

## One-time setup

The steps that created staging, for redoing them or setting up production.

1. Run `fly auth login` in a terminal
2. In Neon, create a project with Postgres 18 in AWS `us-east-1`, on the Launch
   plan, with database name `mmmm`
3. Run `fly apps create mmmm-staging`, then set the Fly secrets above
4. Run `fly deploy --ha=false`
5. Run `age-keygen -o mmmm-backup.key`. Store the file in the password manager,
   set its public key as `BACKUP_AGE_RECIPIENT`, and delete the file
6. From a folder without a `fly.toml`, run
   `fly storage create --name mmmm-backups --org personal`. Inside the repo it
   would attach the bucket to the app and set its keys as app secrets, which the
   app doesn't need. Set the printed key and secret as the GitHub secrets above,
   and `mmmm-backups` as `BACKUP_BUCKET`
7. In the Tigris dashboard, add a lifecycle rule to the bucket that expires
   objects after 30 days
8. Set `STAGING_BACKUP_DATABASE_URL`, then run the Backup workflow from the
   Actions tab and the restore script, to check both
9. Add `mmmm.onl` to Cloudflare, check that the DNS records it imports match
   Namecheap's, and set the domain's nameservers in Namecheap to the two
   Cloudflare lists, under Nameservers, Custom DNS. Wait for Cloudflare to show
   the domain as active
10. In Resend, add the domain `send.mmmm.onl`, add the DNS records it lists in
    Cloudflare under DNS, Records, and wait for Resend to verify them. Turn off
    open and click tracking for the domain, so links in emails are the real
    ones. Then create an API key with sending access and set it as
    `RESEND_API_KEY` on Fly
11. In Cloudflare, under Email, Email Routing, add your inbox as a destination
    address and confirm it, then add a rule that forwards `support@mmmm.onl` to
    it

## Rotating a secret

- **Neon password:** reset it in Neon under Roles, then update `DATABASE_URL` on
  Fly and `STAGING_BACKUP_DATABASE_URL` on GitHub, and deploy
- **`BETTER_AUTH_SECRET`:** set a new random value and deploy. Every session
  signs out
- **Tigris key:** create a new one in the dashboard, update both GitHub secrets,
  then delete the old key
- **age identity:** generate a new pair and update `BACKUP_AGE_RECIPIENT`. Keep
  the old identity until the dumps it encrypted expire, 30 days later
