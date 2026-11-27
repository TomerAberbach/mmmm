# Manual QA

A run of this document visits every page, view, and transition of MMMM in
Chrome, with every role. It needs no knowledge of the code. Terms in this
document follow `glossary.md`.

Each step is one action and one result to check. Steps are numbered by section,
such as 3.12. Codes at the end of a step, such as P9, are the items it covers,
and [Coverage](#coverage) lists them. Compare letters, not case, because the app
shows some text in capitals. L is a contest's contest link, P is a player's
`/player/` address with the contest's ID, and C is an educator's contest page.

## Setup

Run everything in one bash or zsh terminal, from the repository's root, after
`pnpm install`. The commands use only a new local database, `mmmm_qa`. They
never use the development database, `mmmm`. Stop if a variable below already
points anywhere else.

Create the database and load it. The last command seeds 2 educators, the 2025
bracket (published), and the next bracket (unpublished). This document calls the
next year 2027, as it is from April 2026 to March 2027. Outside those dates,
replace 2027 with the year on the home page.

```sh
docker compose up -d --wait postgres
docker compose exec -T postgres psql -U mmmm -d postgres -c 'CREATE DATABASE mmmm_qa'

export DATABASE_URL=postgresql://mmmm:mmmm@localhost:5432/mmmm_qa
export APP_ENV=development PORT=3055 BETTER_AUTH_URL=http://localhost:3055
export ADMIN_LIST=admin@example.com SUPPORT_EMAIL=support@example.com
export EMAIL_TRANSPORT=mailbox EMAIL_FROM='MMMM <noreply@example.com>'
export BETTER_AUTH_SECRET=$(openssl rand -base64 32)
unset RESEND_API_KEY FLY_APP_NAME STAGING_PASSWORD

node prisma/push-schema.ts
pnpm exec prisma generate
pnpm db:seed
```

Start the server. Variables that are set win over `.env`. `BETTER_AUTH_URL` must
have the same port as `PORT`, because emailed links and passkeys use it.

```sh
(pnpm dev > "${TMPDIR:-/tmp}/mmmm-qa.log" 2>&1 &)
until curl -sf localhost:3055/healthz; do sleep 1; done
```

The app is at `http://localhost:3055`, and its email is at
`http://localhost:3055/dev/mailbox`. Email and rate limits are in memory, so a
restart empties both. Restart whenever a step answers "Too many attempts" and it
isn't the step that tests it.

```sh
lsof -ti tcp:3055 -sTCP:LISTEN | xargs kill
(pnpm dev > "${TMPDIR:-/tmp}/mmmm-qa.log" 2>&1 &)
```

Tear everything down at the end. It stops only the server on this port and drops
only this database.

```sh
lsof -ti tcp:3055 -sTCP:LISTEN | xargs kill
docker compose exec -T postgres psql -U mmmm -d postgres -c 'DROP DATABASE mmmm_qa WITH (FORCE)'
unset DATABASE_URL APP_ENV PORT BETTER_AUTH_URL ADMIN_LIST SUPPORT_EMAIL EMAIL_TRANSPORT EMAIL_FROM BETTER_AUTH_SECRET
```

Use Chrome with no other MMMM server's cookies, such as a new profile. Cookies
ignore the port, so signing in on port 3000 signs out port 3055.

### Helper commands

Paste these into the same terminal. `qa_sql` always uses `mmmm_qa`. The others
read `DATABASE_URL`, so check it first with `echo $DATABASE_URL`.

```sh
qa_sql() {
  docker compose exec -T postgres \
    psql -U mmmm -d "${2:-mmmm_qa}" -v ON_ERROR_STOP=1 -c "$1"
}

# The security code for a setup key: qa_code 'ABCD EFGH ...'
qa_code() {
  KEY="$1" node --input-type=module -e "
    const { readTotpCode } = await import('./test/totp.ts')
    const key = process.env.KEY.replaceAll(' ', '')
    console.log(readTotpCode('otpauth://totp/MMMM?secret=' + key))"
}

# The names to paste into the setup form, for a wild card at bottom left, seed 16
qa_names() {
  node --input-type=module -e "
    const { BRACKET_2026 } = await import('./prisma/brackets.ts')
    const { DIVISION_POSITIONS } = await import('./app/bracket.ts')
    const names = DIVISION_POSITIONS.flatMap(
      position => BRACKET_2026.divisions[position].combatants,
    )
    console.log([...names, ...BRACKET_2026.wildCard.entrants].join('\n'))"
}

# Picks all 64 battles for the newest player with a name: qa_fill 'Pat Q.'
# With a status, also submits: qa_fill 'Pat Q.' APPROVED
# A third argument of -1 picks the last contender of each battle
qa_fill() {
  NAME="$1" STATUS="$2" AT="${3:-0}" node --conditions=development --input-type=module -e "
    const { prisma } = await import('./app/db.server.ts')
    const { readBracket } = await import('./app/brackets.server.ts')
    const { toSeededBracket } = await import('./app/seeded-bracket.ts')
    const { readArrangement } = await import('./app/moves.ts')
    const picksServer = await import('./app/player-picks.server.ts')
    const { pickEveryBattle } = await import('./prisma/pick-every-battle.ts')
    const { NAME, STATUS, AT } = process.env
    const player = await prisma.player.findFirstOrThrow({
      where: { displayName: NAME, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { contest: true },
    })
    const bracket = await readBracket(player.contest.year)
    const picks = pickEveryBattle(toSeededBracket(bracket), Number(AT))
    const arrangement = readArrangement(bracket)
    console.log(await picksServer.savePlayerDraft(player.id, picks, arrangement))
    if (STATUS) {
      const submitted = await picksServer.submitPlayerPicks(player.id, picks, arrangement)
      if (submitted.refusal) throw new Error(submitted.refusal)
      await prisma.submission.update({
        where: { playerId: player.id },
        data: { status: STATUS },
      })
      console.log(STATUS)
    }
    await prisma.\$disconnect()"
}

# Scores for Ava, Ben, Jonah, and Priya, until the next result: qa_scores 90 80 70 60
qa_scores() {
  qa_sql "UPDATE \"Submission\" s SET score = v.score, \"picksChangedAt\" = '2026-01-01' FROM \"Player\" p, (VALUES ('Ava L.', $1), ('Ben T.', $2), ('Jonah K.', $3), ('Priya S.', $4)) v(name, score) WHERE p.id = s.\"playerId\" AND p.\"displayName\" = v.name"
}

# Runs a command as if it were another time: qa_clock 2027-04-02T19:00:00Z pnpm dev
qa_clock() {
  QA_NOW="$1" NODE_OPTIONS="--import data:text/javascript,const%20R=Date,o=R.parse(process.env.QA_NOW)-R.now();globalThis.Date=class%20extends%20R{constructor(...a){a.length?super(...a):super(R.now()+o)}static%20now(){return%20R.now()+o}}" "${@:2}"
}
```

## Personas

| Persona                                             | Address                   | Password                                                            | Role                                                                                                  |
| --------------------------------------------------- | ------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Ada                                                 | educator@example.com      | `password`, then `qa-password-2` and `qa-password-3` from section 2 | Educator with seeded contests, at example.com                                                         |
| Grace                                               | admin@example.com         | `password`, then `qa-password-4` from section 3                     | Admin, at example.com                                                                                 |
| Cora                                                | cora@example.com          | `qa-password-1`                                                     | Ada's colleague, signs up in section 1                                                                |
| Otto                                                | otto@outsider.example     | `qa-password-1`                                                     | Educator at another organization. Moves to otto@moved.example, then deletes the account, in section 7 |
| Gia                                                 | gia.qa.mmmm@gmail.com     | `qa-password-1`                                                     | Educator with no organization                                                                         |
| Una                                                 | una@late.example          | `qa-password-1`                                                     | Unconfirmed educator                                                                                  |
| Imported                                            | imported@imported.example | none                                                                | Imported educator, from SQL                                                                           |
| Pat, Quinn, Rory, Sky, Uma, Vic, Wes, First, Second | none                      | none                                                                | Players in Ada's Period 1 Chem                                                                        |
| Olga, Omar, Bo, Xan, Gil, Ava                       | none                      | none                                                                | Players in Otto's, Gia's, and Ada's contests                                                          |
| Nobody                                              | none                      | none                                                                | A signed-out visitor                                                                                  |

Nothing is ever sent, so the addresses need no inbox.

**Several at once.** Use one Chrome profile for each educator (Ada, Grace, Cora,
and one shared by Otto and Gia), one for players, and a Guest window for Nobody.
All incognito windows share one set of cookies, so they count as one. A player's
cookie is per contest, so one player window can hold one player in each contest.

**One window only.** Do the steps in order, and sign out with **Sign out**
whenever the persona changes. Sign in as Grace only for her steps, with a code
from `qa_code`. Where a step says "second browser" or "stale tab", open the
stale page in a second tab first. For Nobody and players, sign out first.
Between players in one contest use **Not you? Start a new bracket**, and keep
each personal link in a note.

**Passkeys** need a device, or Chrome DevTools, More tools, WebAuthn, "Enable
virtual authenticator environment" with resident keys and user verification on.
Steps that need one say "Manual". Automation skips them and uses the
authenticator app: press **Can’t scan it?**, copy the key, and run `qa_code`
with it.

**Offline** means DevTools, Network, Offline.

**Steps that need a device or a native prompt.** A passkey: 1.23, 3.42, 3.43,
3.44, 3.45, 3.46, 3.47, 3.48, 3.49, 3.50, 3.51, 3.52, 3.53, 3.54, 14.34, 16.6. A
download: 3.22. Print preview: 16.23, 16.24, 16.25. Chrome's own dialog: 16.27.
A person checks these.

## 1. Signed out and signing up

Start here right after setup. The current year is 2025 and it's open.

- [ ] **1.1** Nobody, `/`. Open it. Expect: "Play March Mammal Madness with your
      class", "Sign up", "Sign in", the note that players don't need an account,
      "MMMM adds the 2027 bracket once ASU publishes it in late February.", then
      "2025 bracket". _AS1 AV1 DV27_
- [ ] **1.2** Nobody, `/bracket`. Open it. Expect: "2025 bracket" and the
      bracket. _CV22 DV26_
- [ ] **1.3** Nobody, footer. Open **Privacy policy**, **Terms**, and
      **Retention schedule**. Expect: Each says "This is a draft. A lawyer will
      review it before MMMM launches." _AV52_
- [ ] **1.4** Nobody, `/no-such-page`. Open it. Expect: "Page not found", "Check
      the address for typos, or ask whoever sent you the link for a new one.", a
      "Go to the home page" link, the header, and the footer. _AV54 AK14_
- [ ] **1.5** Nobody, `/dev/mailbox`. Open it. Expect: "No emails yet. Signing
      up sends one." _AV53_
- [ ] **1.6** Nobody, `/sign-up`. Press **Sign up** with **Full name**, **Email
      address**, and **Create a password** empty. Expect: "Enter your full
      name", "Enter an email address like name@school.org", "Enter a password of
      at least 10 characters". _AV6_
- [ ] **1.7** Nobody, `/sign-up`. Enter a password of 129 characters and press
      **Sign up**. Expect: "Shorten the password to 128 characters or fewer".
      _AV6_
- [ ] **1.8** Nobody, `/sign-up`. Use the full name `turd` with a valid address
      and password, and press **Sign up**. Expect: "Remove the offensive words
      from your full name". _AV6_
- [ ] **1.9** Cora, `/sign-up`. Sign up as Cora. Expect: "Check your email", "We
      sent a link to cora@example.com. Open it to confirm your address. It
      expires in 3 days." _AE1 AE2 AT1 AV7_
- [ ] **1.10** Cora, that page. Press **Resend email**. Expect: "Sent again at"
      with the time. _AT7_
- [ ] **1.11** Cora, `/dev/mailbox`. Open it. Expect: 2 emails "Confirm your
      email address for MMMM" to Cora. _AM1 AV53_
- [ ] **1.12** Cora, `/sign-in`. Enter Cora's address and password before
      confirming. Expect: "Check your email", "Confirm your address before you
      sign in. Open the link we sent to cora@example.com when you signed up.
      Each link expires in 3 days." _AT6 AV12 AE2_
- [ ] **1.13** Cora, that page. Press **Sign up again** and sign up as Cora
      again with the name Cora Colleague. Expect: "Check your email". _AT1 AE2_
- [ ] **1.14** Cora, mailbox. Open the oldest of Cora's 3 confirmation links.
      Expect: `/sign-in`: "That confirmation link has expired or doesn’t work.
      Sign in to get a new one if your address isn’t confirmed yet". _AT5 AV11_
- [ ] **1.15** Cora, mailbox. Open the newest link. Expect: "Your email address
      is confirmed. Sign in to create your first contest". _AT3 AE4 AV11_
- [ ] **1.16** Cora, mailbox. Open the same link again. Expect: The same notice.
      _AT4_
- [ ] **1.17** Cora, address bar. Change the last letters of the link's token
      and open it. Expect: "That confirmation link has expired or doesn’t work.
      Sign in to get a new one if your address isn’t confirmed yet". _AT5_
- [ ] **1.18** Cora, `/sign-up`. Sign up as Cora once more. Expect: "Check your
      email", as for a new address. _AT2_
- [ ] **1.19** Cora, mailbox. Open it. Expect: "You already have an MMMM
      account". _AM2_
- [ ] **1.20** Cora, `/sign-up`. Sign up as Cora again, which is the 4th attempt
      this hour. Expect: "Too many attempts. Try again in" with the minutes.
      _AV8 AL2_
- [ ] **1.21** Nobody, `/sign-in`. Press **Forgot password?**, then Back.
      Expect: `/forgot-password`, then "Sign in" with "Sign in with a passkey"
      and "Sign up". _AV9 AV19_
- [ ] **1.22** Nobody, `/sign-in`. Press **Sign in** with the right address and
      a wrong password. Expect: "Email address or password is incorrect". _AV9
      AV10_
- [ ] **1.23** Nobody, `/sign-in`. Press **Sign in with a passkey**, then cancel
      Chrome's prompt. Manual. Expect: "That didn’t sign you in. Try again, or
      use your password". _AV13_
- [ ] **1.24** Cora, `/sign-in`. Sign in as Cora. Expect: `/contests`: "Your
      contests", "Name your organization" with example.com, "Create a contest".
      _AX1 AS3 AE5 CV1 CV1.2 CO2 AF1_
- [ ] **1.25** Cora, `/`. Open it. Expect: `/contests`. _AV4 DV27_
- [ ] **1.26** Cora, `/sign-in`, `/sign-up`, `/sign-in/code`,
      `/sign-in/recovery-code`. Open each. Expect: Each opens `/contests`.
      _AV18_
- [ ] **1.27** Cora, `/admin`. Open it. Expect: "Page not found". _AV39_
- [ ] **1.28** Cora, `/settings`. Open it. Expect: "Account settings" with Name,
      Organization, Password, Sessions, Delete account, and no Second factor.
      "Your example.com organization has no name yet. Name it on your contests
      page." _AV28 AV29_
- [ ] **1.29** Cora, `/settings`. Press **Forgot password?** under Password.
      Expect: "Reset your password" while signed in, with "Back to account
      settings". _AV22 AK10_
- [ ] **1.30** Cora, `/forgot-password`. Send a reset link to Cora. Expect:
      "Check your email" with "Back to account settings". _AK10 AV21_
- [ ] **1.31** Cora, header. Press **Sign out**. Expect: The home page, with
      "Sign in" in the header. _AX13 AS1_
- [ ] **1.32** Otto, `/sign-up`. Sign up, confirm, and sign in as Otto. Expect:
      `/contests` with "Name your organization" and outsider.example. _AX1 DO8_
- [ ] **1.33** Gia, `/sign-up`. Sign up, confirm, and sign in as Gia. Expect:
      `/contests` without "Name your organization". _CO1 CV1.2_
- [ ] **1.34** Gia, `/settings`. Open it. Expect: "Your email address is from a
      free provider, so you have no organization and no organization
      leaderboard." _AV29_
- [ ] **1.35** Una, `/sign-up`. Sign up as Una and don't confirm. Expect: "Check
      your email". _AE2_

## 2. Account settings and passwords

- [ ] **2.1** Ada, `/sign-in`. Sign in as Ada. Expect: `/contests`. _AS3 AX1
      CV1.3_
- [ ] **2.2** Ada, `/settings`. Clear **Full name** and press **Save name**.
      Expect: "Enter your full name". _AV28_
- [ ] **2.3** Ada, `/settings`. Enter `turd` and press **Save name**. Expect:
      "Remove the offensive words from your full name". _AT9_
- [ ] **2.4** Ada, `/settings`. Enter `Ada Byron` and press **Save name**.
      Expect: "Saved your name", and the header shows Ada Byron. _AT9_
- [ ] **2.5** Ada, `/settings`. Enter a wrong **Current password**, the new
      password `qa-password-2`, and press **Change password**. Expect: "Your
      password is incorrect". _AV34_
- [ ] **2.6** Ada, second browser. Sign in as Ada there too. Expect:
      `/contests`. _AS3_
- [ ] **2.7** Ada, first browser, `/settings`. Press **Sign out other
      sessions**. Expect: A dialog "Sign out other sessions?" _AV35_
- [ ] **2.8** Ada, that dialog. Press **Sign out other sessions**. Expect:
      "Every other session is signed out". _AV35 AX13_
- [ ] **2.9** Ada, second browser. Reload `/contests`. Expect: `/sign-in`.
      _AX13_
- [ ] **2.10** Ada, second browser. Sign in again, then change the password in
      the first browser to `qa-password-2`. Expect: First browser: "Your
      password is changed, and every other session is signed out. We emailed you
      about the change". _AT10 AX13_
- [ ] **2.11** Ada, second browser. Reload. Expect: `/sign-in`. _AX13_
- [ ] **2.12** Ada, mailbox. Open it. Expect: "Your MMMM password was changed".
      _AM4_
- [ ] **2.13** Nobody, `/forgot-password`. Open it signed out. Expect: "Reset
      your password", "Send reset link". _AV19_
- [ ] **2.14** Nobody, `/forgot-password`. Press **Send reset link** for
      `nobody@nowhere.example`. Expect: "Check your email", "If an account uses
      nobody@nowhere.example, we sent it a link to reset your password.", and no
      new email in the mailbox. _AV21_
- [ ] **2.15** Ada, `/forgot-password`. Send a reset link to Ada twice. Expect:
      "Check your email" each time, and 2 emails "Reset your MMMM password".
      _AE9 AM3 AV21_
- [ ] **2.16** Ada, mailbox. Open the first reset link. Expect: "Set a new
      password", "Set password". _AV23_
- [ ] **2.17** Ada, that page. Enter `short` and press **Set password**. Expect:
      "Enter a password of at least 10 characters". _AV23_
- [ ] **2.18** Ada, that page. Enter `qa-password-3` and press **Set password**.
      Expect: "Your password is changed. Sign in with your new password". _AT8
      AX13 AV11_
- [ ] **2.19** Ada, mailbox. Open the same reset link, then the second one.
      Expect: "That reset link has expired or was already used. Enter your email
      address to get a new one" for each. _AV20 AT8_
- [ ] **2.20** Nobody, `/reset-password`. Open it without a token. Expect: The
      same notice at `/forgot-password?link-invalid`. _AV24_
- [ ] **2.21** Ada, `/sign-in`. Sign in with `qa-password-3`. Expect:
      `/contests`. _AX1_
- [ ] **2.22** Ada, mailbox. While signed in, open the used reset link. Expect:
      "That reset link has expired or was already used. Enter your email address
      to get a new one". _AV20 AV22_
- [ ] **2.23** Una, `/forgot-password`. Send a reset link to Una, open it, and
      set `qa-password-1`. Expect: "Your password is changed. Sign in with your
      new password", and Una can sign in, because the link confirms the address.
      _AT8 AE4_
- [ ] **2.24** Una, terminal. Make Una unconfirmed again with a contest, with
      the "Unconfirmed educator" SQL in [Forcing states](#forcing-states).
      Expect: `INSERT 0 1`. _AE3_
- [ ] **2.25** Una, `/sign-up`. Sign up as Una. Expect: "Check your email" and
      an email "You already have an MMMM account", because the contest keeps the
      account. _AE3 AT2_

## 3. Admin's second factor

- [ ] **3.1** Nobody, `/admin`. Open it signed out. Expect: `/sign-in`. _AV38_
- [ ] **3.2** Grace, `/sign-in`. Press the logo, press **Sign in**, and sign in
      as Grace. Expect: `/contests`, with **Admin** in the header. _AE6 CV1.2
      AK13_
- [ ] **3.3** Ada, `/contests`. Look at the header in Ada's window. Expect: No
      **Admin**. _AK13_
- [ ] **3.4** Grace, `/settings`. Open it. Expect: "Admins need at least one to
      open the admin area.", "No passkeys yet.", "Off.", and "Open the admin
      area to set one up". _AV30 AV31 AF1_
- [ ] **3.5** Grace, `/admin`. Open it. Expect: `/admin/setup`: "Set up a second
      factor", "Email me a setup link". _AT16 AV40 AV49_
- [ ] **3.6** Grace, `/admin/verify`. Open it. Expect: `/admin/setup`. _AV49_
- [ ] **3.7** Grace, `/admin/setup/authenticator-app`. Open it. Expect:
      `/admin/setup`. _AV46_
- [ ] **3.8** Grace, `/admin/setup`. Press **Email me a setup link**. Expect:
      "We emailed you a setup link. It expires in 1 hour", and the button is
      **Send again**. _AF2 AV41_
- [ ] **3.9** Grace, that page. Press **Send again**. Expect: 2 emails "Set up
      your MMMM second factor". _AM5 AG8_
- [ ] **3.10** Grace, mailbox. Open the first setup link. Expect: "That setup
      link has expired or was already used. Email yourself a new one". _AV42
      AG8_
- [ ] **3.11** Grace, mailbox. Open the second setup link. Expect: "Set up a
      second factor" with "Passkey", "Recommended", "Add a passkey", and
      "Authenticator app". _AX8 AS4 AV43_
- [ ] **3.12** Grace, mailbox. Open the second setup link again. Expect: The
      same choices, and no notice that the link was used. _AV43_
- [ ] **3.13** Grace, that page. Press **Use an authenticator app**. Expect:
      "Set up your authenticator app", "Enter your password to start." _AV45
      AG3_
- [ ] **3.14** Grace, that page. Enter a wrong password and press **Continue**.
      Expect: "Your password is incorrect". _AV34 AV45_
- [ ] **3.15** Grace, that page. Enter the password and press **Continue**.
      Expect: A QR code and "Can’t scan it?" _AF4 AG3 AV45_
- [ ] **3.16** Grace, second tab. Open `/admin/setup/authenticator-app`, enter
      the password, press **Continue**, and press **Can’t scan it?**. Expect: A
      key that differs from the first tab's. _AG4 AF4_
- [ ] **3.17** Grace, first tab. Enter a code for the first tab's key and press
      **Turn on**. Expect: "That QR code no longer works, since setup changed in
      another tab. Enter your password for a new one". _AG4 AK4_
- [ ] **3.18** Grace, third tab, left on the password step. Open
      `/admin/setup/authenticator-app` there and don't submit. Expect: "Enter
      your password to start." _AK4_
- [ ] **3.19** Grace, second tab. Enter `12345` and press **Turn on**. Expect:
      "Enter the 6-digit code from your authenticator app". _AV45_
- [ ] **3.20** Grace, second tab. Enter `000000` and press **Turn on**. Expect:
      "That code is incorrect or expired. Enter the code your app shows now".
      _AV45_
- [ ] **3.21** Grace, second tab. Enter the code from `qa_code` for that tab's
      key and press **Turn on**. Expect: "Save your recovery codes", 10 codes,
      and **Continue** is off until "I’ve saved these codes" is checked. _AG5
      AF5 AX9 AS5 AV45_
- [ ] **3.22** Grace, that page. Press **Copy codes** and **Download**. Expect:
      "Copied", and a file `mmmm-recovery-codes.txt`. _AV45_
- [ ] **3.23** Grace, that page. Keep the codes, check the box, and press
      **Continue**. Expect: `/admin`: "Admin". _AV45 DV5 DV3_
- [ ] **3.24** Grace, third tab. Enter the password and press **Continue**.
      Expect: `/admin`. _AK4_
- [ ] **3.25** Grace, `/admin/bracket` or `/admin/contests`. Press **Admin**
      above the title. Expect: `/admin`. _AK13_
- [ ] **3.26** Grace, `/admin/setup`, `/admin/setup/authenticator-app`,
      `/admin/verify`. Open each. Expect: Each opens `/admin`. _AV44 AV46 AV49_
- [ ] **3.27** Grace, mailbox. Open it. Expect: An email "An authenticator app
      was turned on for your MMMM account". _AM8_
- [ ] **3.28** Grace, header. Sign out, then sign in with the password. Expect:
      `/sign-in/code`: "Enter your security code". _AX2 AS2 AV14_
- [ ] **3.29** Grace, that page. Enter `000000` and press **Continue**. Expect:
      "That code is incorrect or expired. Enter the code your app shows now".
      _AX4_
- [ ] **3.30** Grace, that page. Enter a wrong code 5 more times. Expect:
      `/sign-in?too-many-codes`: "You entered too many incorrect codes. Sign in
      again". _AX5 AL6 AV11 AK8_
- [ ] **3.31** Grace, `/sign-in`. Sign in with the password, then enter 5 wrong
      codes and 1 more. Expect: "Too many incorrect codes. Wait up to 15
      minutes, then try again" on a try. _AX6 AF6 AL6_
- [ ] **3.32** Grace, terminal. Run the "Unlock the authenticator app" SQL.
      Expect: `UPDATE 1`. _AF6_
- [ ] **3.33** Grace, `/sign-in`. Sign in with the password and press **Use a
      recovery code instead**. Expect: "Use a recovery code", "Use your
      authenticator app", and the support address. _AV17_
- [ ] **3.34** Grace, that page. Enter `wrong-codes` and press **Continue**.
      Expect: "That recovery code is incorrect or already used". _AX4_
- [ ] **3.35** Grace, that page. Enter one saved recovery code. Expect:
      `/contests`. _AX3_
- [ ] **3.36** Grace, `/settings`. Open it. Expect: "On. 9 recovery codes left."
      _AV33_
- [ ] **3.37** Grace, `/settings`. Enter a wrong **Password** and press **Get
      new recovery codes**. Expect: "Your password is incorrect". _AV34_
- [ ] **3.38** Grace, `/settings`. Enter the password and press **Get new
      recovery codes**. Expect: "Here are your new recovery codes. Your old ones
      no longer work.", 10 new codes, "On. 10 recovery codes left.", and no
      email. _AG7_
- [ ] **3.39** Grace, `/sign-in/code`. Sign out, sign in, choose the recovery
      code page, and enter an old recovery code. Expect: "That recovery code is
      incorrect or already used". _AX4_
- [ ] **3.40** Grace, that page. Press **Use your authenticator app** and enter
      the code from `qa_code`. Expect: `/contests`. _AX3_
- [ ] **3.41** Grace, `/settings`. Enter the password and press **Turn off**.
      Expect: "Admins keep at least one second factor. Add another before
      removing this one". _AF7_
- [ ] **3.42** Grace, `/settings`. Press **Add a passkey**. Manual, needs a
      device or Chrome's virtual authenticator. Expect: The passkey is listed
      with its date, and the mailbox has "A passkey was added to your MMMM
      account". _AG1 AF3 AM6 AV33_
- [ ] **3.43** Grace, `/settings`. Press **Add a passkey** and cancel Chrome's
      prompt. Manual. Expect: "The passkey wasn’t added. Try again". _AG1_
- [ ] **3.44** Grace, `/settings`. Enter the password and press **Turn off**.
      Manual, needs the passkey. Expect: "Off.", and the mailbox has "The
      authenticator app was turned off for your MMMM account". _AG6 AM9_
- [ ] **3.45** Grace, `/settings`. Press **Remove**, then **Remove passkey**.
      Manual. Expect: "Admins keep at least one second factor. Add another
      before removing this one". _AF7_
- [ ] **3.46** Grace, header. Sign out. At `/sign-in` press **Sign in with a
      passkey**. Manual. Expect: `/contests`, and `/admin` opens without more
      steps. _AX7 AS5_
- [ ] **3.47** Grace, `/sign-in`. Sign out, then sign in with the password.
      Expect: `/contests`, because only the app asks for a code. Manual. _AX1_
- [ ] **3.48** Grace, `/admin`. Open it. Manual. Expect: `/admin/verify`: "Use
      your second factor", "Use your passkey to open the admin area.", "Use your
      passkey". _AV47 AS3_
- [ ] **3.49** Grace, `/admin/verify`. Press **Use your passkey** and cancel.
      Manual. Expect: "Your passkey wasn’t accepted. Try again". _AV47_
- [ ] **3.50** Grace, `/admin/verify`. Press **Use your passkey**. Manual.
      Expect: `/admin`. _AX10_
- [ ] **3.51** Grace, `/settings`. Press **Set up an authenticator app** and
      turn it on again. Manual. Expect: `/admin` after the recovery codes. _AG5_
- [ ] **3.52** Grace, `/admin/verify`. Run the "Make the second factor stale"
      SQL with a passkey and the app on, then open it. Manual. Expect: **Use
      your passkey**, "Or sign out, then sign in again and enter the code from
      your app.", and "Lost it? Email" with the support address. _AK6 AV47_
- [ ] **3.53** Grace, two tabs, `/settings`. Sign in with the code first. Press
      **Remove** then **Remove passkey** in the first tab. Manual. The title is
      "Remove this passkey?" when the passkey has no provider. Expect: The
      passkey is gone, and the mailbox has "A passkey was removed from your MMMM
      account". _AG2 AM7_
- [ ] **3.54** Grace, second tab. Press **Remove** then **Remove passkey**
      there. Manual. Expect: "This passkey is gone. Reload the page". The dialog
      stays open, with the error and **Reload** below its buttons. _AG2 RG1 RG2_
- [ ] **3.55** Grace, `/settings`. Change the password to `qa-password-4`.
      Expect: "Your password is changed, and every other session is signed out.
      We emailed you about the change", and the Second factor section still has
      its buttons. _AX12 AT10_
- [ ] **3.56** Grace, `/admin`. Open it. Expect: `/admin`, without using the
      second factor again. _AX12_
- [ ] **3.57** Grace, terminal. Run the "Make the second factor stale" SQL, then
      reload `/admin`. Expect: `/admin/verify`: "The admin area asks for your
      second factor again every 12 hours.", "Sign out, then sign in again and
      enter the code from your app.", and "Lost it? Email" with the support
      address. _AX11 AS6 AV48_
- [ ] **3.58** Grace, `/settings`. Open it with the stale session. Expect: "Open
      the admin area and use your second factor before changing these". _AV31_
- [ ] **3.59** Grace, `/settings`. Look at "Delete account". Expect: "Open the
      admin area and use your second factor before deleting your account", and
      no button. _AV36 AT11_
- [ ] **3.60** Grace, `/settings` open with the dialog "Delete your account?"
      before the SQL. Type Grace's address and press **Delete account**. Expect:
      "Use your second factor before deleting your account. Reload the page to
      see how". _AV36 AT11_
- [ ] **3.61** Grace, `/admin/verify`. Press **Sign out**, then sign in with the
      code. Expect: `/contests`. _AV48 AX3_
- [ ] **3.62** Nobody, `/sign-in/code`. Open it signed out in a fresh browser
      and press **Continue** with `123456`. Expect: `/sign-in`: "Your sign-in
      timed out before the code was accepted. Sign in again". _AV15 AV11_
- [ ] **3.63** Grace, fresh browser, `/sign-in/code`. Sign in with the password,
      leave the code page open, turn the app off with the "Remove second
      factors" SQL, then enter a code. Expect: "Your sign-in timed out before
      the code was accepted. Sign in again". _AV16_
- [ ] **3.64** Grace, fresh browser, `/sign-in/recovery-code`. Set up the app
      again as in 3.65, then do the same with the recovery code page open.
      Expect: "Your sign-in timed out before the code was accepted. Sign in
      again". _AV16_
- [ ] **3.65** Grace, `/admin`. Sign in, email a setup link, open it, and set up
      the app again. Expect: `/admin`. _AX8 AX9_
- [ ] **3.66** Grace, `/settings`, 2 tabs. Open it, run "Turn off the app" in
      the terminal, then press **Get new recovery codes** in an open tab.
      Expect: "Your authenticator app is off. Reload the page". _AK3_
- [ ] **3.67** Grace, `/admin/contests` while signed in. Run the "Remove second
      factors" SQL and open it. Expect: `/admin/setup`. _AK7_
- [ ] **3.68** Grace, `/admin/setup/authenticator-app`. Set up the app, run
      "Turn off the app", open this page again, and enter the password. Expect:
      A new QR code, though a row of the old app was left. _AK5_
- [ ] **3.69** Grace, `/admin/setup/authenticator-app`. Turn the app on with a
      code. Expect: Recovery codes. Keep them. _AK5_
- [ ] **3.70** Grace, 2 browsers, `/sign-in/recovery-code`. Sign in with the
      password in both, then submit the same code in both. Expect: One signs in.
      The other says "That recovery code is incorrect or already used", or, at
      the same instant, "Your sign-in timed out before the code was accepted.
      Sign in again". _AK15_

## 4. No current year, and setting up a bracket

Run this before any other section that changes the bracket. It hides 2025 with
SQL and brings it back at the end.

- [ ] **4.1** Ada, `/contests`. Press **Create contest** and type `Too early`,
      but don't submit. Then run the "Hide every year" SQL in the terminal.
      Expect: `DO`. _DY2 CY1_
- [ ] **4.2** Ada, that dialog. Press **Create contest**. Expect: "Contests open
      once the bracket is published, so this one wasn’t created". _C1 DX6a_
- [ ] **4.3** Ada, `/contests`. Reload. Expect: "Your contests", "ASU publishes
      it in late February.", "The 2027 bracket isn’t ready yet", and no
      contests. _CV1.1 DX1a_
- [ ] **4.4** Nobody, `/`. Open it signed out. Expect: The intro and "MMMM adds
      the 2027 bracket once ASU publishes it in late February.", and no bracket
      below. _AV2 DV27_
- [ ] **4.5** Nobody, `/bracket`. Open it. Expect: "Page not found". _CV22 DV26_
- [ ] **4.6** Ada, `/contests/years/2025/leaderboards/global`. Open it. Expect:
      "Page not found". _DX3a_
- [ ] **4.7** Grace, `/admin/results`. Open it. Expect: `/admin`. _DV18_
- [ ] **4.8** Grace, `/admin`. Open it. Expect: Only the 2027 card, "Setup",
      **Manage the 2027 bracket**, and the links Past years, Reports (0),
      Educators, Contests, and Organizations. _DV2 DV5 DY2_
- [ ] **4.9** Grace, `/admin/bracket`. Press **Manage the 2027 bracket**.
      Expect: "2027 bracket", Phase, "Only admins see this bracket.", filled
      fields, and Delete bracket. _DV7_
- [ ] **4.10** Grace, that page. Press **Publish 2027 bracket**, read the
      dialog, and press **Cancel**. Expect: The dialog has no paragraph about a
      year that becomes read-only. _DV8_
- [ ] **4.11** Grace, that page. Enter an expected lock date in March 2027 and
      press **Save date**. Expect: "Saved the expected lock date". _DT6_
- [ ] **4.12** Grace, `/admin`. Open it. Expect: "Expected to lock on" with that
      date. _DV2_
- [ ] **4.13** Grace, `/admin/bracket`. Clear one seed's name and press **Save
      changes**. Expect: An error list above the form that names the field, and
      its link moves focus there. _DV9_
- [ ] **4.14** Grace, that page. Give 2 seeds the same name and press **Save
      changes**. Expect: An error on each that says to give each combatant its
      own name. _DV9_
- [ ] **4.15** Grace, that page. Undo, change a division's name, and press
      **Save changes**. Expect: `/admin`, and the expected lock date is kept.
      _DT2_
- [ ] **4.16** Grace, two tabs, `/admin/bracket`. Change a division's name in
      the first and press **Save changes**. In the second press **Publish 2027
      bracket** and confirm. Expect: "This bracket changed since the page
      loaded. Reload the page". The dialog stays open, with the error and
      **Reload** below its buttons. _DM11 RG1 RG2_
- [ ] **4.17** Grace, second tab. Press **Delete 2027 bracket** and confirm.
      Expect: "This bracket changed since the page loaded. Reload the page". The
      dialog stays open, with the error and **Reload** below its buttons. _DM12
      RG1 RG2_
- [ ] **4.18** Grace, second tab. Press **Save changes**. Expect: "This bracket
      changed since the page loaded, so nothing was saved. Reload the page to
      see it, or save these names in its place", and **Save these names
      anyway**. _DM9_
- [ ] **4.19** Grace, second tab. Press **Save these names anyway**. Expect:
      `/admin`, and the second tab's names are saved. _DM10_
- [ ] **4.20** Grace, two tabs, `/admin/bracket`. Change the same name the same
      way in both, and press **Save changes** in each. Expect: `/admin` both
      times. _DM13_
- [ ] **4.21** Grace, two tabs, `/admin/bracket`. Delete the bracket in the
      first tab with **Delete 2027 bracket**, twice. Expect: `/admin`: "Set up
      the 2027 bracket" with "Not set up yet". _DT3 DY1 DV1_
- [ ] **4.22** Grace, second tab. Press **Save changes**. Expect: "This bracket
      changed since the page loaded, so nothing was saved. Reload the page to
      see it, or save these names in its place". _DT2 DM9_
- [ ] **4.23** Grace, second tab. Press **Delete 2027 bracket** and confirm.
      Expect: "This bracket is already published or deleted. Reload the page".
      The dialog stays open, with the error and **Reload** below its buttons.
      _DT3 RG1 RG2_
- [ ] **4.24** Grace, second tab. Look at the page behind the dialog. Expect:
      The "Phase" section and **Delete 2027 bracket** are still there. _RG1_
- [ ] **4.25** Grace, second tab. Press **Cancel**, then **Save these names
      anyway**. Expect: `/admin` with **Manage the 2027 bracket**. _DM10_
- [ ] **4.26** Grace, `/admin/bracket`. Delete the bracket again. Press **Set up
      the 2027 bracket**. Expect: An empty form with "Enter the combatants from
      ASU’s bracket.", **Save bracket**, and no Phase. _DV6_
- [ ] **4.27** Grace, that page. Press **Paste names**, paste 3 lines, and press
      **Fill in the fields**. Expect: "Found 3 names. Paste" with the count the
      page asks for. _DV10_
- [ ] **4.28** Grace, that page. Set the wild card to bottom left, seed 16, with
      2 entrants. Paste the output of `qa_names`, press **Fill in the fields**,
      fill the 4 division names, and press **Save bracket**. Expect: `/admin`
      with **Manage the 2027 bracket**. _DT1 DY2_
- [ ] **4.29** Grace, `/admin/bracket`, 2 tabs. Open it in a second tab and
      leave it. In the first press **Publish 2027 bracket** and confirm. Expect:
      `/admin/results`: "2027 bracket", "Open", "Published" with today's date,
      "The first result locks submissions." _DT4 DY3_
- [ ] **4.30** Grace, second tab. Press **Save changes**. Expect: "This bracket
      can’t change here now. Reload the page". _DT2_
- [ ] **4.31** Grace, first tab. Press **Review 1 swap** after a swap of seeds 1
      and 2 of a division. Expect: "This clears the picks of", "Moving them back
      won’t restore what’s cleared.", and no count of players. _DM18_
- [ ] **4.32** Grace, `/admin/results`. Cancel and read it. Expect: The date
      form, **Unpublish**, and "Possible until an educator creates a contest".
      _DV12_
- [ ] **4.33** Grace, `/admin/bracket`. Open it. Expect: `/admin/results`.
      _DV11_
- [ ] **4.34** Nobody, `/`. Open it signed out. Expect: "2027 bracket", and no
      "MMMM adds" line. "Brackets are expected to lock on" with the date if one
      is set. _AV3 DV27_
- [ ] **4.35** Grace, two tabs, `/admin/results`. Press **Unpublish** in the
      first tab, read the dialog, and confirm. Expect: "and the previous
      bracket, if any, becomes the current one on the home page." Then
      `/admin/bracket` with Setup. _DT5_
- [ ] **4.36** Grace, second tab. Press **Unpublish** and confirm. Expect: "The
      2027 bracket can’t be unpublished now. Reload the page". The dialog stays
      open, with the error and **Reload** below its buttons. _DT5 RG1 RG2_
- [ ] **4.37** Grace, second tab. Press **Reload**. Expect: `/admin`, since no
      year is published. _RG2_
- [ ] **4.38** Grace, `/admin/bracket`. Press **Delete 2027 bracket** and read
      the dialog, then press **Cancel**. Expect: "Only admins see it while it’s
      unpublished." _DT3_
- [ ] **4.39** Grace, terminal. Run the "Show 2025 again" SQL. Expect: `DO`, and
      `/contests` lists contests again. _CY2 DY3_
- [ ] **4.40** Grace, `/admin`. Open it. Expect: The 2025 card with "Open" and
      **Manage the 2025 bracket**, and no 2027 card. _DV3_

## 5. Educator's contests while open

- [ ] **5.1** Ada, `/contests`. Open it. Expect: "2025" above "Your contests",
      Period 2 and Period 5 Biology with **Copy link**, **Create contest** in
      the header, a link "2025 bracket", "Deleted contests (1)". _CN3 CV1.3
      CV1.5 CY2 DX1b CS1_
- [ ] **5.2** Ada, `/contests`. Press **Save name** under "Name your
      organization" with nothing. Expect: "Enter the organization’s name". _CO2_
- [ ] **5.3** Ada and Cora, `/contests` in 2 browsers. Ada saves `Example High`.
      Then Cora saves `Other High` in her old tab. Expect: Ada's card is
      replaced by "Saved your organization’s name", which has focus, and the
      label is "2025 · Example High". Cora sees "Your organization already has a
      name. Reload the page". _CO3 CO4 RG13_
- [ ] **5.4** Ada, `/settings`. Open it. Expect: "Example High, from your
      example.com address. To change its name, email" and a link to the support
      address". _AV29_
- [ ] **5.5** Otto, `/contests`. Leave his organization unnamed. Expect: "Name
      your organization" stays. _CO2_
- [ ] **5.6** Ada, `/contests`. Press **Create contest** and submit an empty
      name. Expect: **Cancel** is before **Create contest**, and "Enter the
      contest’s name". _C1_
- [ ] **5.7** Ada, that dialog. Enter 81 characters. Expect: "Shorten the
      contest’s name to 80 characters or fewer". _C1_
- [ ] **5.8** Ada, that dialog. Enter `turd`. Expect: "Remove the offensive
      words from the contest’s name". _C1_
- [ ] **5.9** Ada, that dialog. Enter `Period 1 Chemistry` and press **Create
      contest**. Expect: The contest's page with "2025 contest". _C1 DX6b_
- [ ] **5.10** Ada, that page. Read it. Expect: Contest link, **Copy link**,
      "Show a QR code", **Replace contest link**, "No one has started a bracket
      yet. Share the contest link with your players.", "Shared with", "Trash
      (0)", **Delete contest**. _CV3.1 DX2b_
- [ ] **5.11** Ada, that page. Press **Copy link**. Expect: "Copied", then "Copy
      link" again. _CV3.1_
- [ ] **5.12** Ada, that page. Press **Show a QR code**. Expect: A QR code.
      _CV3.1_
- [ ] **5.13** Ada, that page. Press **Rename**, change the name, and press
      Escape. Expect: The old name, and **Rename** has focus. _C2 RG3_
- [ ] **5.14** Ada, that page. Press **Rename**, enter `Period 1 Chem`, and
      press **Save**. Expect: "Saved the contest name", and **Rename** has
      focus. _C2 RG3_
- [ ] **5.15** Ada, Period 5 Biology. Press **Delete contest**, read, and
      cancel. Expect: "Its contest link stops working." _CN9_
- [ ] **5.16** Ada, Period 2 Biology. Press **Delete contest**, read, and
      cancel. Expect: "Its 8 brackets go with it, and its contest link and
      personal links stop working." _CN9_
- [ ] **5.17** Ada, Period 1 Chem. Copy the link. Press **Replace contest
      link**. Expect: "Replace the contest link?" _C3_
- [ ] **5.18** Ada, that dialog. Press **Replace contest link**. Expect:
      "Replaced the contest link. The old one no longer works". _C3 CS8_
- [ ] **5.19** Nobody, the old link. Open it. Expect: "This link doesn’t work",
      "Ask your educator for a new one." _AV57 CV14.5 C3_
- [ ] **5.20** Ada, Period 2 Biology. Open it. Expect: Sections "Pending (4)",
      "Approved (2)", "Rejected (1)", "Started, not submitted (1)", and "Trash
      (2)". _CV3.1 PS2 PS1_
- [ ] **5.21** Ada, that page. Find Maya R. and maya r. Expect: Each row says
      "This might be the same player as" the other, and the link moves focus to
      that row. _CV3.1_
- [ ] **5.22** Ada, that page. Press **Approve** on Jonah K. Expect: Jonah K.
      moves to Approved. _P14 PS2_
- [ ] **5.23** Ada, that page. Press **Reject** on Jonah K., then **Approve**
      again. Expect: It moves each time, and no button returns it to pending.
      _P15 P14_
- [ ] **5.24** Ada, that page. Select Priya S. and Ninja Cat. Expect: "2
      selected", **Clear**, **Approve 2**, **Reject 1**, **Delete 2**. **Approve
      all** is off. _CV3.6_
- [ ] **5.25** Ada, that page. Select a row, scroll so that another row is just
      above the bar at the bottom of the window, and click its checkbox. Expect:
      It's selected and the page doesn't scroll. _RG4 CV3.6_
- [ ] **5.26** Ada, that page. Press Tab until a row under the bar has focus.
      Expect: The page scrolls it into view. _RG4_
- [ ] **5.27** Ada, that page. Press Escape. Expect: The bar leaves. _CV3.6_
- [ ] **5.28** Ada, that page. Select both and press **Clear**. Expect: The bar
      leaves. _CV3.6_
- [ ] **5.29** Ada, that page. Select both and press **Approve 2**. Expect: Both
      are in Approved. _P14_
- [ ] **5.30** Ada, that page. Select Ninja Cat and press **Reject 1**. Expect:
      It's in Rejected. _P15_
- [ ] **5.31** Ada, that page. Press **Approve all 2**, read "Approve 2 pending
      brackets?" with "You can still reject them later.", and press **Cancel**.
      Expect: Nothing changes. _P14_
- [ ] **5.32** Ada, that page. Open **•••** for Leo M., press **Rename**, clear
      the name, and press **Save**. Expect: "Enter the player’s name". _P8_
- [ ] **5.33** Ada, that row. Enter `Leo N.` and press **Save**. Expect:
      "Saved". _P8_
- [ ] **5.34** Ada, that page. **•••** for Leo N., **Replace personal link**.
      Expect: "Replace Leo N.’s personal link?" _P7_
- [ ] **5.35** Ada, that dialog. Press **Replace personal link**. Expect: "Leo
      N.’s new personal link", the link, and "The link is copied. You won’t be
      able to see it again." or "Copy the link now. You won’t be able to see it
      again." _P7_
- [ ] **5.36** Ada, that dialog. Press **Close**. Expect: **•••** in Leo N.'s
      row has focus. _RG13_
- [ ] **5.37** Ada, that page. Turn Chrome offline in DevTools and do it again.
      Expect: "Couldn’t replace Leo N.’s personal link". _P7_
- [ ] **5.38** Ada, that page. **•••** for Maya R., **Delete**. Expect: "Delete
      Maya R.’s bracket?" _P16_
- [ ] **5.39** Ada, that dialog. Press **Delete bracket**. Expect: The row
      leaves and "Trash (3)". _P16 PS5_
- [ ] **5.40** Ada, that page. Select 2 rows and press **Delete 2**, then
      **Cancel**. Expect: "Delete 2 brackets?", and nothing changes after
      Cancel. _P16_
- [ ] **5.41** Ada, `/contests/:id/trash`. Press **Trash (3)**. Expect: "Trash",
      rows such as "Sam T. · Approved", "Deleted by you," with a time, and
      "Deleted by player," with "Restore it by" and a date. _CV4 PS5 PS6_
- [ ] **5.42** Ada, that page. Press **Restore** on Maya R. Expect: The row
      leaves, and Maya R. is back with her status on the contest's page. _P18_
- [ ] **5.43** Ada, that page. Press **Delete forever** on Sam T. Expect:
      "Delete Sam T.’s bracket forever?" _P19_
- [ ] **5.44** Ada, that dialog. Press **Delete forever**. Expect: The row
      leaves. _P19 PS7_
- [ ] **5.45** Ada, that page. Press **Empty trash**, then confirm in "Empty the
      trash?". Expect: "The trash is empty." _P19 CV4_
- [ ] **5.46** Ada, `/contests/trash`. Press **Deleted contests (1)** on
      `/contests`. Expect: "Deleted contests", "Period 7 Biology", "0
      submissions, 0 drafts", "Deleted" with a time, and the back link "All
      contests". _CV8 CS2_
- [ ] **5.47** Ada, that page. Press **Restore**. Expect: The row leaves, "The
      trash is empty.", and Period 7 is on `/contests`. _C5 CV8_
- [ ] **5.48** Ada, Period 7 Biology. Press **Delete contest**. Expect: "Delete
      Period 7 Biology?" _C4_
- [ ] **5.49** Ada, that dialog. Press **Delete contest**. Expect: `/contests`
      with "Deleted contests (1)". _C4 CS2_
- [ ] **5.50** Ada, `/contests/trash`. Press **Delete forever**, then confirm in
      "Delete Period 7 Biology and its brackets forever?". Expect: "The trash is
      empty." _C6 CS7_
- [ ] **5.51** Ada, `/contests`. Create `Trash A` and `Trash B`, delete both,
      then press **Empty trash** and **Empty trash** in the dialog. Expect: "The
      trash is empty." _C7_
- [ ] **5.52** Ada, Period 2 Biology. Share with `nobody@example.com`. Expect:
      "No one in your organization signed up with this email address". _C9_
- [ ] **5.53** Ada, that page. Share with Ada's own address. Expect: "This is
      your own email address. Enter a colleague’s". _C9_
- [ ] **5.54** Ada, that page. Share with Otto's address. Expect: "No one in
      your organization signed up with this email address". _C9_
- [ ] **5.55** Ada, that page. Share with Cora's address and press **Share
      contest**. Expect: "Shared the contest", and Cora is listed. _C9 CS6_
- [ ] **5.56** Cora, `/contests`. Reload. Expect: "Shared with you", Period 2
      Biology, Ada Byron. _CV1.5_
- [ ] **5.57** Cora, Period 2 Biology. Open it. Expect: "Shared by Ada Byron.
      You can see it but not change it.", sections without buttons, **Report a
      name**, and no contest link. _CV3.4 RD2_
- [ ] **5.58** Cora, `/contests/:id/trash` of that contest. Open it. Expect:
      "Page not found". _CV4_
- [ ] **5.59** Cora, `/contests/:id/leaderboard`. Open it while open. Expect:
      The contest's page. _CV5 DX3b_
- [ ] **5.60** Ada, Period 2 Biology. Press **Stop sharing**, then confirm in
      "Stop sharing with Cora Colleague?". Expect: Cora leaves the list, and
      "Shared the contest" is gone. _C10 RG11_
- [ ] **5.61** Cora, Period 2 Biology. Reload. Expect: "Page not found". _CV3.5
      C10_
- [ ] **5.62** Ada, Period 2 Biology. Share with Cora again. Expect: "Shared the
      contest". _C9_
- [ ] **5.63** Otto, Period 2 Biology's address. Open it. Expect: "Page not
      found". _CV3.5_
- [ ] **5.64** Ada, `/contests/past`. Open it. Expect: "No past years yet."
      _CV9_
- [ ] **5.65** Ada, `/contests/reports`. Open it. Expect: "No reports." _CV13_
- [ ] **5.66** Ada, `/contests/years/2025`. Open it. Expect: "2025 bracket" and
      the diagram, without leaderboard links while the year is open. _CV10_
- [ ] **5.67** Ada, `/contests/years/2024`, `/contests/years/abc`,
      `/contests/years/20255`. Open each. Expect: "Page not found". _CV10_
- [ ] **5.68** Ada, `/contests/years/2025/leaderboards/global` and
      `/organization`. Open each. Expect: `/contests`. _CV11 DX3b_
- [ ] **5.69** Ada, `/contests/new` and `/contests/organization`. Open each.
      Expect: `/contests`. _CV2_
- [ ] **5.70** Ada, Period 2 Biology's address with `/report`, `/name`, `/link`,
      `/delete`, `/shares`, `/shares/stop`, `/players/delete`,
      `/players/status`, `/players/x/name`, `/players/x/personal-link`,
      `/trash/restore`, `/trash/erase`. Open each. Expect: The contest's page,
      or its trash for the last 2. _CV7_
- [ ] **5.71** Otto, `/contests`. Create `Otto Zoology` and `Otto Botany`, then
      create and delete `Otto Trash`. Expect: 2 contests, and "Deleted contests
      (1)". _C1 C4_
- [ ] **5.72** Gia, `/contests`. Create `Gia Homeroom`. Expect: The contest's
      page without "Shared with". _C1 CO1_

## 6. Players while open

Use Ada's `Period 1 Chem` contest link, shown as L. A player's pages are at
`/player/` and the contest's ID, shown as P.

- [ ] **6.1** Pat, L. Open it. Expect: "What’s your first name and last
      initial?", "Period 1 Chem · Ada Byron’s contest", "March Mammal Madness
      2025", **Report a name**. _CV14 CV14.1 CV14.4 DX4b RD1_
- [ ] **6.2** Pat, L. Press **Start my bracket** with no name. Expect: "Enter
      your first name and last initial". _P1_
- [ ] **6.3** Pat, L. Enter 31 characters. Expect: "Shorten your first name and
      last initial to 30 characters or fewer". _P1_
- [ ] **6.4** Pat, L. Enter `turd`. Expect: "Use a different name. This one has
      a word MMMM doesn’t allow". _P1_
- [ ] **6.5** Pat, L. Enter `Pat Q.` and press **Start my bracket**. Expect:
      P`/bracket`: "0 of 64 picked", "Picks save as you go", **Next battle to
      pick**, **Submit bracket**. _P1 PS1 PS9 CV18 CV18.1 DX5b_
- [ ] **6.6** Pat, P`/bracket`. Press a side in "Round 1, battle 1". Expect:
      "Saved at" with the time, and "1 of 64 picked". _P9_
- [ ] **6.7** Pat, P`/bracket`. Press **Submit bracket**. Expect: "Pick 63 more
      battles to submit. Next up:" with a battle, inside the bar that sticks
      above the diagram, with the next battle outlined and in view, and no
      request in DevTools' Network. _P11 RG5_
- [ ] **6.8** Pat, P`/bracket`. Press the empty side of "Final Roar, battle 1"
      and pick a name. Expect: The menu says "Pick who gets here. Their earlier
      wins fill in too", and the count goes up. _P9_
- [ ] **6.9** Pat, P`/bracket`. Pick the other side of that combatant's Round 1
      battle. Expect: "Your change cleared", a count such as "3 later picks that
      depended on it", and the battles, inside the bar, and the diagram stays in
      place in the window. _P9 RG5_
- [ ] **6.10** Pat, P`/bracket`. Turn Chrome offline and pick. Expect: "Couldn’t
      save. Your picks are still here" and **Try again**. _RP1_
- [ ] **6.11** Pat, P`/bracket`. Go online and press **Try again**. Expect:
      "Saved at". _RP1_
- [ ] **6.12** Pat, terminal. Run `qa_fill 'Pat Q.'` and reload P`/bracket`.
      Expect: "64 of 64 picked". _P9_
- [ ] **6.13** Pat, P`/bracket`. Go offline and press **Submit bracket**.
      Expect: "Couldn’t submit. Your picks are still here" and **Try again**.
      _RP4_
- [ ] **6.14** Pat, P`/bracket`. Go online and press **Try again**. Expect:
      "Bracket submitted", "Save your personal link", the link, and "Your
      bracket counts once your educator approves it". _P10 PS2_
- [ ] **6.15** Pat, P`/bracket`. Reload. Expect: "Submitted · waiting for
      approval", **Show my personal link**, **Done, forget my bracket here**,
      "Submitted picks last changed" with the time, and "If you didn’t make a
      change, tell your educator." _CV18.1_
- [ ] **6.16** Pat, P`/bracket`. Press **Show my personal link** and copy it.
      Expect: "Your personal link". _CV18.1_
- [ ] **6.17** Pat, P`/bracket`. Change a pick in the Championship. Expect:
      "Changes not submitted", **Discard changes**, **Submit changes**, "Your
      submitted bracket stays as it was until you submit these changes." _PS3
      CV18.1_
- [ ] **6.18** Pat, P`/bracket`. Go offline, press **Discard changes**, and
      confirm in "Discard your changes?". Expect: "Couldn’t discard your
      changes" and **Try again**. _RP5_
- [ ] **6.19** Pat, P`/bracket`. Go online and press **Try again**. Expect:
      "Submitted · waiting for approval". _P13_
- [ ] **6.20** Pat, P`/bracket`. Change the champion and press **Submit
      changes**. Expect: "Changes submitted". _P12_
- [ ] **6.21** Ada, Period 1 Chem. Approve Pat Q. Expect: Pat is in Approved.
      _P14_
- [ ] **6.22** Pat, P`/bracket`. Reload. Expect: "Submitted · approved".
      _CV18.1_
- [ ] **6.23** Pat, P`/bracket`. Change a pick. Expect: "Your submitted bracket
      still counts until you submit these changes." _CV18.1 PS3_
- [ ] **6.24** Pat, P`/bracket`. Change a pick and press **Submit changes**.
      Expect: "Changes submitted", "Your educator approved your bracket, and it
      stays approved", and the status is kept. _P12_
- [ ] **6.25** Pat, P`/leaderboards/contest`. Open it while open. Expect:
      P`/bracket`. _CV20 DX3b_
- [ ] **6.26** Pat, L. Open it. Expect: "Continue as Pat Q.?" and **Continue as
      Pat Q.**. _CV14.2 P2_
- [ ] **6.27** Pat, L. Press **Continue as Pat Q.**. Expect: P`/bracket`. _P2_
- [ ] **6.28** Pat, P`/bracket`. Press **Done, forget my bracket here**, then
      **Forget my bracket**. Expect: P`/forgotten`: "This device forgot your
      bracket". _P4 CV19_
- [ ] **6.29** Pat, P`/bracket`. Open it. Expect: P`/forgotten`. _CV18.4_
- [ ] **6.30** Pat, personal link. Open it. Expect: P`/bracket`. _P6 CV17_
- [ ] **6.31** Pat, P`/forgotten`. Open it while remembered. Expect:
      P`/bracket`. _CV19_
- [ ] **6.32** Pat, DevTools, Application. Delete the `player-…` cookie and pick
      again in the open page. Expect: P`/forgotten` after a reload: "Open your
      personal link to come back to your bracket. If you don’t have one, ask
      your educator for a personal link to the bracket you started, or open the
      contest link they shared to start a new bracket." _P5 CV19 CN6_
- [ ] **6.33** Pat, P`/bracket/picks`, P`/delete`, P`/report`. Open the personal
      link again, then each. Expect: P`/bracket` for the first 2, and
      P`/leaderboards/contest`, which redirects to P`/bracket`, for the third.
      _CV21_
- [ ] **6.34** Nobody, L`/report`. Open it. Expect: L. _CV21_
- [ ] **6.35** Nobody, P. Open it. Expect: P`/bracket`, or P`/forgotten` when no
      one is remembered. _CV21_
- [ ] **6.36** Pat, L. Press **Not you? Start a new bracket**. Expect: L's name
      form. _P3_
- [ ] **6.37** Pat, L. Look at the focus after pressing it. Expect: The name
      field has focus. _RG13_
- [ ] **6.38** Quinn, L. Start as `Quinn R.` and pick 3 battles. Expect: "3 of
      64 picked". _P1 PS1_
- [ ] **6.39** Nobody, `/`. Open it signed out in the same window. Expect: The
      same home page as for anyone. _AV5_
- [ ] **6.40** Rory, L. Press **Not you? Start a new bracket**, start as
      `Rory S.`, run `qa_fill 'Rory S.'`, reload, and submit. Expect: "Bracket
      submitted". _P3 P10_
- [ ] **6.41** Ada, Period 1 Chem. Reject Rory S. Expect: Rory is in Rejected.
      _P15_
- [ ] **6.42** Rory, P`/bracket`. Reload. Expect: "Submitted · not approved" and
      the alert "Your educator didn’t approve your bracket. You can ask them
      about it". _CV18.1_
- [ ] **6.43** Rory, P`/bracket`. Pick and press **Submit changes**. Expect: The
      status stays not approved. _P12_
- [ ] **6.44** Sky, L. Start as `Sky T.`, fill, submit, and change the champion
      without submitting. Expect: "Changes not submitted". _PS3_
- [ ] **6.45** Uma, L. Start as `Uma V.`, fill, and submit. Expect: "Bracket
      submitted". Keep Uma's personal link. _P10_
- [ ] **6.46** Vic, L. Start as `Vic W.`, fill, submit, and keep the personal
      link. Press **Delete my bracket**. Expect: "Delete your bracket?" with
      "ask your educator to restore it within 7 days, or before next year’s
      bracket is published, if that’s sooner". _P17_
- [ ] **6.47** Vic, that dialog. Press **Delete my bracket**. Expect:
      L`/deleted`: "Your bracket is deleted" and **Start a new bracket**. _P17
      CV15 PS6_
- [ ] **6.48** Vic, personal link. Open it. Expect: "This bracket was deleted",
      "It was deleted on a device that had it open.", "ask your educator to
      restore it by" with a date and ", or before next year’s bracket is
      published, if that’s sooner", and **Start a new bracket**. _CV17 AV57_
- [ ] **6.49** Ada, Period 1 Chem's trash. Restore Vic W. Expect: Vic W. is back
      in Pending. _P18_
- [ ] **6.50** Vic, personal link. Open it. Expect: P`/bracket`. _P6_
- [ ] **6.51** Ada, Period 1 Chem. Delete Vic W. Expect: "Trash (1)". _P16_
- [ ] **6.52** Vic, personal link. Open it. Expect: "Your educator deleted this
      bracket", "Ask them if you think that’s a mistake.", and **Start a new
      bracket**. _CV17_
- [ ] **6.53** Wes, L. Start as `Wes X.`, fill, submit, keep the link. Ada
      presses **Replace contest link**, then deletes Wes. Expect: From here L is
      the new link. Wes's personal link shows "Your educator deleted this
      bracket" without **Start a new bracket**. _PS10 CV17 P16_
- [ ] **6.54** Wes, `/bracket-deleted`. Ada restores Wes. Wes opens the personal
      link and presses **Delete my bracket** twice. Expect: `/bracket-deleted`:
      "Your bracket is deleted" without **Start a new bracket**. _CV15 P17_
- [ ] **6.55** Ada, Uma V.'s row. Make a new personal link, then Uma opens the
      old one. Expect: "This link doesn’t work". _P7 AV57_
- [ ] **6.56** Uma, new personal link. Open it. Expect: P`/bracket`. _P6_
- [ ] **6.57** Xan, Otto Trash's contest link. Otto restores the contest, Xan
      starts as `Xan Y.`, Otto deletes the contest, and Xan opens the link.
      Expect: `/contest-removed`: "Your educator deleted this contest", "Ask
      them if you think that’s a mistake." _CV14.5 CV16_
- [ ] **6.58** Olga, Otto Zoology's link. Start as `Olga O.`, fill, and submit.
      Start `Omar O.` in another browser, fill, submit, and Otto approves Omar.
      Expect: Olga is pending and Omar is approved. _P10 P14_
- [ ] **6.59** Bo, Otto Botany's link. Start as `Bo B.`, fill, and submit.
      Expect: "Bracket submitted". _P10_
- [ ] **6.60** Gil, Gia Homeroom's link. Start as `Gil G.`, fill, submit, and
      Gia approves. Expect: Gil is approved. _P10 P14_
- [ ] **6.61** Ava, Period 2 Biology. Ada makes a new personal link for Ava L.
      and opens it in the player window. Expect: P`/bracket` with "Submitted ·
      approved". _P7_
- [ ] **6.62** Nobody, `/my-bracket/x`, `/play/x`, `/player/x/bracket`. Open
      each. Expect: "This link doesn’t work", "Ask your educator for a new one,
      unless it’s from a past year.". _CV17 CV14.5 AV57_

## 7. Reports and the admin area while open

- [ ] **7.1** Nobody, L of Period 1 Chem. Press **Report a name**. Expect: The
      reasons leave out "Not a real player". _CN7_
- [ ] **7.2** Nobody, that dialog. Press **Send report** with no reason. Expect:
      "Choose what’s wrong with it". _R1_
- [ ] **7.3** Cora, Period 2 Biology. Press **Report a name**, choose a player
      and "Not a real player", then choose the contest's name. Expect: The
      reasons start over, without "Not a real player". Cancel. _CN7_
- [ ] **7.4** Nobody, that dialog. Choose "Rude or hurtful" and press **Send
      report**. Expect: "Thanks. Your report was sent". _R1 RS1 RS3_
- [ ] **7.5** Cora, Period 2 Biology. Press **Report a name**, choose Leo N. and
      "Someone’s full name", and send. Do the same with "Not a real player" and
      "Something else". Expect: "Thanks. Your report was sent" each time. _R1
      RD2_
- [ ] **7.6** Ada, header. Reload. Expect: "Reports (4)". _CV13 RS1_
- [ ] **7.7** Ada, `/contests/reports`. Press **Reports (4)**. Expect: Each row
      has "See the contest", **Dismiss**, and the reason. _CV13_
- [ ] **7.8** Ada, that page. Press **Dismiss** on Period 1 Chem's. Expect: The
      row leaves and the header shows "Reports (3)". _R3 RS2_
- [ ] **7.9** Grace, `/admin/reports`. Open it. Expect: All 4, with "See the
      contest" and **Dismiss**. _DV19 DN1 RS3_
- [ ] **7.10** Grace, that page. Press **See the contest**. Expect:
      `/admin/contests/` with the contest's ID. _DM6_
- [ ] **7.11** Grace, that page. Press **Dismiss** on Period 1 Chem's. Expect:
      The row leaves. _R3 RS4_
- [ ] **7.12** Nobody, L of Period 1 Chem. Send the same report again. Expect:
      It's back on Ada's and Grace's lists. _R2 DN2_
- [ ] **7.13** Ada, Period 2 Biology. Delete Leo N. Expect: His 3 reports leave
      both lists. _R4 RS5 DN3_
- [ ] **7.14** Ada, its trash. Restore Leo N. Expect: They're back. _R4 DN3_
- [ ] **7.15** Grace, `/admin/reports`. Read a date in the evening. Expect: The
      date is today in your time zone. _DV19_
- [ ] **7.16** Grace, `/admin/contests`. Open it. Expect: Rows such as "2025 ·
      Ada Byron · Example High · 4 approved" with **Hide**, and "In the trash ·
      …" listed last without buttons. _DV21 DK1 DK4_
- [ ] **7.17** Grace, that page. Press **Hide** on Period 2 Biology, then **Hide
      contest**. Expect: "Hidden · 2025 · …", listed first, with **Show**. _DKA1
      C14 DK2 CS5_
- [ ] **7.18** Ada, Period 2 Biology. Open it. Expect: "This contest is hidden,
      so its brackets aren’t on the organization or global leaderboards. Its own
      leaderboard still works. Email" with the support address. _CS5 CN1_
- [ ] **7.19** Cora, Period 2 Biology. Open it, then open print preview. Expect:
      The same note, which doesn't print. _CN1_
- [ ] **7.20** Grace, that page. Press **Show**, then **Show contest**. Expect:
      The row returns to its place. _DKA1 DK1_
- [ ] **7.21** Grace, `/admin/contests/:id`. Open Period 5 Biology. Expect: "No
      players yet." _DV22_
- [ ] **7.22** Grace, that page. Open Period 1 Chem. Expect: Every player, with
      "In the trash" on deleted ones. _DV22_
- [ ] **7.23** Grace, that page. Press **Delete forever** on Vic W., then
      **Delete forever** in "Delete Vic W.’s bracket forever?". Expect: The row
      leaves. _DKA3 P22 PS7_
- [ ] **7.24** Ada, `/contests`. Create `Rude Zoology`, and start `Player` in it
      as a player. Expect: "Started, not submitted (1)". _CN8_
- [ ] **7.25** Grace, `/admin/contests/:id` of Rude Zoology. Press **Rename**,
      clear the name, and press **Save**. Expect: "Enter the contest’s name".
      _DM1_
- [ ] **7.26** Grace, that page. Enter `turd`, which admins may use, and press
      **Save**. Expect: "Saved the contest name". _DM1_
- [ ] **7.27** Grace, that page. Rename it to `Kind Zoology`. Expect: "Saved the
      contest name". _DM1_
- [ ] **7.28** Grace, that page. Press **Hide** and confirm, then **Show** and
      confirm. Expect: "Saved the contest name" leaves, then "Hidden · 2025 ·
      …", then without "Hidden". _DM4 RG11_
- [ ] **7.29** Grace, two tabs, that page. Press **Delete forever** at the
      bottom. Expect: "Delete Kind Zoology forever?", "This deletes the contest
      and its 1 bracket, trash included." _DM2_
- [ ] **7.30** Grace, that dialog. Press **Delete forever** with nothing, then
      with `wrong`. Expect: "Type the contest’s name", then "This isn’t the
      contest’s name". _DM3_
- [ ] **7.31** Grace, that dialog. Type `Kind Zoology` and press **Delete
      forever**. Expect: `/admin/contests` without it. _DM2 CS7_
- [ ] **7.32** Grace, second tab. Press **Delete forever**, type the name, and
      confirm. Expect: "This contest is gone. Reload the page". _DM3_
- [ ] **7.33** Grace, second tab. Press **Rename** and **Save**. Expect: "This
      contest is gone. Reload the page". _DM1_
- [ ] **7.34** Ada, its address. Open it. Expect: "Page not found". _DM2 CV3.5_
- [ ] **7.35** Grace, `/admin/contests/x`. Open it. Expect: "Page not found".
      _DV22_
- [ ] **7.36** Grace, `/admin/contests?page=999`. Open it. Expect: The last
      page. _DV21_
- [ ] **7.37** Grace, `/admin/educators`. Open it. Expect: Only the form with
      **Find educator**. _DV20 AV50_
- [ ] **7.38** Grace, that page. Find `nobody`. Expect: "Enter an email address
      like name@school.org". _DV20 AV50_
- [ ] **7.39** Grace, that page. Find `nobody@nowhere.example`. Expect: "No
      educator has this email address". _AV50 DV20_
- [ ] **7.40** Grace, that page. Find Una. Expect: "una@late.example,
      unconfirmed", **Delete account**, and no **Change address**. _AV50 DES2
      DV20 AE3_
- [ ] **7.41** Grace, that page. Find `imported@imported.example`, after the
      "Imported educator" SQL. Expect: Unconfirmed, with no **Change address**.
      _DES3 DI3_
- [ ] **7.42** Grace, that page. Find Otto. Expect: "otto@outsider.example,
      confirmed", organization outsider.example, contests, "Signed up" with a
      date. _AV50 DES1 DV20_
- [ ] **7.43** Grace, that page. Press **Change address**, which focuses **New
      email address**. Enter Ada's address, and press **Send link**. Expect: "An
      account already has this email address". _AV51 DE1_
- [ ] **7.44** Grace, that dialog. Enter `otto@moved.example` and press **Send
      link**. Expect: "We emailed the new address. The educator’s address
      changes once they confirm it". _AT13 DE1 AE8_
- [ ] **7.45** Grace, that page. Send a link to `otto@moved.example` again.
      Expect: "We emailed the new address. The educator’s address changes once
      they confirm it", and the first link is dead. _AT13_
- [ ] **7.46** Nobody, mailbox. Open the first link to otto@moved.example.
      Expect: "This link doesn’t work", "It expired, was already used, or was
      replaced by a newer link. Check your email for a newer one, or email" with
      a support link, and "Go to the home page". _AV26_
- [ ] **7.47** Otto, mailbox. Open the second link, "Confirm your new email
      address for MMMM". Expect: "Confirm your email address", "You’ll sign in
      with otto@moved.example and your current password. Every browser signed in
      to your account is signed out.", **Confirm email address**. _AM10 AV25_
- [ ] **7.48** Otto, that page. Press **Confirm email address**. Expect:
      `/sign-in?address-changed`: "Your email address is changed. Sign in with
      your new address". _AT14 DE2 AK9_
- [ ] **7.49** Otto, his other window. Reload. Expect: `/sign-in`. _AT14 AX13_
- [ ] **7.50** Otto, mailbox. Open it. Expect: "Your MMMM email address was
      changed" to the old address. _AM11_
- [ ] **7.51** Otto, that link. Open it again. Expect: "This link doesn’t work".
      _AV26_
- [ ] **7.52** Otto, `/sign-in`. Sign in as otto@moved.example. Expect:
      `/contests` with moved.example. _AT14 DO8_
- [ ] **7.53** Grace, `/admin/organizations`. Open it. Expect: Example High
      "example.com · 3 educators", "Not named yet" moved.example, and
      outsider.example with "0 educators". _DV23 DO1 DO2 DO3_
- [ ] **7.54** Grace, that page. Press **Rename** on moved.example, enter
      `Moved Academy`, and press **Save**. Expect: "Saved". _DO4_
- [ ] **7.55** Grace, two tabs, that page. Press **Delete data** on
      outsider.example in the first tab. Expect: "This deletes 0 accounts, 0
      contests, and 0 brackets, past years included." _DV23 DO6_
- [ ] **7.56** Grace, that dialog. Press **Delete all data** with nothing, then
      with `wrong`. Expect: "Type the domain", then "This isn’t the
      organization’s domain". _DO7_
- [ ] **7.57** Grace, that dialog. Type `outsider.example` and press **Delete
      all data**. Expect: The row leaves. _DO6_
- [ ] **7.58** Grace, second tab. Press **Rename** on outsider.example and save.
      Expect: "This organization is gone. Reload the page". _DO5_
- [ ] **7.59** Grace, second tab. Press **Delete data** on outsider.example and
      confirm. Expect: "This organization is gone. Reload the page". _DO5 DO7_
- [ ] **7.60** Grace, that page. Delete example.com's data. Expect: "Your own
      account is in this organization, so you can’t delete its data". _DO7_
- [ ] **7.61** Grace, `/admin/organizations/data?domain=example.com`. Open it.
      Expect: JSON with the counts. _DV25_
- [ ] **7.62** Cora, `/admin/organizations/data?domain=example.com`. Open it.
      Expect: "Page not found", or a 404. _DV25_
- [ ] **7.63** Grace, `/admin/bracket/delete`, `/admin/bracket/publication`,
      `/admin/bracket/expected-lock-date`, `/admin/bracket/move`,
      `/admin/bracket/rename`, `/admin/results/save`, `/admin/results/reopen`,
      `/admin/reports/dismiss`, `/admin/educators/x/delete`,
      `/admin/educators/x/address`, `/admin/contests/hand-over`,
      `/admin/contests/hidden`, `/admin/contests/x/erase`,
      `/admin/organizations/rename`, `/admin/organizations/delete`,
      `/admin/bracket/rename-division`, `/admin/contests/x/name`,
      `/admin/contests/x/erase-contest`. Open each. Expect: The page that posts
      to it. _DV24_
- [ ] **7.64** Grace, `/admin/educators`. Find Una, press **Delete account**,
      and type a wrong address. Expect: "This isn’t the account’s email
      address". _DE3_
- [ ] **7.65** Grace, that dialog. Type Una's address and press **Delete
      account**. Expect: "The account is deleted". _AT12 DE3 AE10 AK12_
- [ ] **7.66** Grace, `/admin/contests`. Open it. Expect: Una's class is first:
      "Hidden · 2025 · No educator", with **Hand over** and **Show**. _DK2 DK3
      C12 CS3 CS5_
- [ ] **7.67** Otto, `/settings`. Press **Delete account**, type a wrong
      address. Expect: "This isn’t the account’s email address". _AV36_
- [ ] **7.68** Otto, that dialog. Read it. Expect: "2 contests stay without an
      educator", and nothing on sharing, since Otto shares none. _AV36_
- [ ] **7.69** Ada, `/settings`. Press **Delete account**, read, and cancel.
      Expect: "The contests this account shares stop being shared, and it loses
      those shared with it." _AV36 CN9_
- [ ] **7.70** Gia, `/settings`. Press **Delete account** while Gia shares none,
      read, and cancel. Expect: Nothing on sharing. _AV36_
- [ ] **7.71** Otto, that dialog. Type Otto's address and press **Delete
      account**. Expect: `/account-deleted`: "Your account is deleted". _AT11
      AV27 AE10 C12_
- [ ] **7.72** Ada, `/account-deleted`. Open it while signed in. Expect:
      `/contests`. _AV27_
- [ ] **7.73** Olga, Otto Zoology's link. Press **Not you?**. Expect: Olga is
      forgotten, and the page is "This contest takes no new players", "A former
      educator’s contest". _P3 CV14.3 CV14.4 CS3_
- [ ] **7.74** Olga, stale tab with the name form, opened before Otto's
      deletion. Press **Start my bracket**. Expect: "This contest’s educator
      left MMMM, so no one can start a bracket". _P1_
- [ ] **7.75** Olga, personal link. Open it. Expect: P`/bracket`: "Submitted ·
      can’t be approved", and no "tell your educator". _CV18.1 CN4_
- [ ] **7.76** Olga, P`/bracket`. Change the champion and press **Submit
      changes**. Expect: "Your educator left MMMM, so no one can approve your
      bracket. Until the first result is posted, you can change your picks and
      submit them again." _CN4_
- [ ] **7.77** Bo, P`/bracket`. Press **Delete my bracket**. Expect: "Your
      educator left MMMM, so this can’t be undone." _P17_
- [ ] **7.78** Bo, that dialog. Press **Delete my bracket**, then open the
      personal link. Expect: `/bracket-deleted?orphaned=` and the link's page
      say "Your educator left MMMM, so they can’t restore it." The link's page
      also says "This contest takes no new players, so you can’t start a new
      bracket." _CV15 CV17 CN4_
- [ ] **7.79** Xan, Otto Trash's link. Open it. Expect: "Your educator deleted
      this contest", "Your educator left MMMM, so they can’t restore it." _CN4
      CV16_
- [ ] **7.80** Grace, `/admin/contests`. Find Otto Trash. Expect: "In the trash
      · 2025 · No educator", with **Hand over** and no **Hide**. _DK5 CS4_
- [ ] **7.81** Grace, that row. Press **Hand over**. Expect: "It’s in the trash.
      Handing it over restores it.", "The new educator gets it with all its
      brackets. It then counts toward their organization, if they have one.",
      and the address field has focus. _DM5_
- [ ] **7.82** Grace, that dialog. Find Ada's address, read, and press
      **Cancel**. Expect: "It then counts toward their organization." _DM5_
- [ ] **7.83** Grace, that row. Press **Hand over** and find Gia's address.
      Expect: "They have no organization, so it counts toward none." _DM5_
- [ ] **7.84** Grace, that dialog. Press **Hand over to** Gia's name. Expect:
      The row is out of the trash and Gia's. _DM5 DKA2 C13_
- [ ] **7.85** Xan, personal link or Otto Trash's link. Open it. Expect: The
      bracket or the name form works again. _DM5_
- [ ] **7.86** Grace, `/admin/contests`. Press **Hand over** on Otto Botany, and
      find `nobody@nowhere.example`. Expect: "No confirmed educator has this
      email address". _DKA2_
- [ ] **7.87** Grace, two tabs, that dialog. Find Gia's address in both. Expect:
      **Hand over to** Gia's name. _DKA2_
- [ ] **7.88** Grace, first tab. Press it. Expect: The row's educator is Gia.
      _DKA2 C13_
- [ ] **7.89** Grace, second tab. Press it. Expect: "This contest can’t be
      handed over now. Reload the page". _DKA2_
- [ ] **7.90** Gia, `/contests`. Reload. Expect: Otto Botany is listed. _C13_

## 8. Moves and renames while open

- [ ] **8.1** Grace, `/admin/results`. Read it. Expect: "Educators have created
      contests, so the bracket stays published." _DV13_
- [ ] **8.2** Grace, that page. Enter a date next week and press **Save date**,
      then clear it and press **Save date**. Expect: "Saved the expected lock
      date" each time. _DT6_
- [ ] **8.3** Ada, `/contests`, and Pat at P`/bracket`. Set a date again and
      open both. Expect: Each shows "Brackets are expected to lock on" with the
      date. _CV22 CN2_
- [ ] **8.4** Nobody, `/` and `/bracket`. Open each. Expect: "Brackets are
      expected to lock on" with the date, "Players can submit until the first
      result is posted." _DV26 AV1_
- [ ] **8.5** Grace, that page. Press **Rename** on Addax, clear the name, and
      press **Save**. Expect: "Enter the combatant’s name". _DC1_
- [ ] **8.6** Grace, that row. Enter 81 characters. Expect: "Shorten the
      combatant’s name to 80 characters or fewer". _DC1_
- [ ] **8.7** Grace, that row. Enter `sun bear`. Expect: "Sun Bear is already a
      combatant. Give each combatant its own name". _DC1_
- [ ] **8.8** Grace, that row. Enter `Addax Antelope` and press **Save**.
      Expect: The row shows Addax Antelope and "Saved", and its **Rename** has
      focus. _DC1 RG12 RG3_
- [ ] **8.9** Grace, that page. Press **Rename division** in the first group,
      clear the name, and press **Save**. Expect: "Enter the division’s name".
      _DM8_
- [ ] **8.10** Grace, that form. Enter 81 characters. Expect: "Shorten the
      division’s name to 80 characters or fewer". _DM8_
- [ ] **8.11** Grace, that form. Enter another division's name. Expect: "is
      already a division. Give each division its own name". _DM8_
- [ ] **8.12** Grace, that form. Enter a new name and press **Save**. Expect:
      The group and every bracket show it, with "Saved" beside **Rename
      division**. _DM7 RG12_
- [ ] **8.13** Pat, P`/bracket`. Reload. Expect: Addax Antelope, and Pat's picks
      are kept. _P27_
- [ ] **8.14** Grace, that page. Under "Move combatants" add a swap of 2
      combatants, then press **Remove** beside it. Expect: The list is empty.
      _DC2_
- [ ] **8.15** Grace, that page. Add a swap and the same swap reversed, and
      press **Review 2 swaps**. Expect: "The swaps cancel out, so no combatant
      moves." _DC2 DM17_
- [ ] **8.16** Grace, that dialog. Press **Move combatants**. Expect: "The swaps
      canceled out, so no combatant moved", and no swaps are listed. _DM17_
- [ ] **8.17** Grace, that page. Add a swap right after. Expect: It's listed,
      with **Review 1 swap**. _DM17_
- [ ] **8.18** Grace, two tabs, that page. In both, add a swap of seeds 1 and 2
      of one division, and press **Review 1 swap**. Expect: "Move combatants?",
      "submissions return to drafts" with a count, "Those players see a note to
      finish and submit.", and "Moving them back won’t restore what’s cleared."
      _DC2_
- [ ] **8.19** Grace, first tab. Press **Move combatants**. Expect: "Moved the
      combatants". _DC2 DC3_
- [ ] **8.20** Grace, second tab. Press **Move combatants**. Expect: "This
      bracket changed since the page loaded. Reload the page". The error is on
      the page, with **Reload** beside it. _DC2 RG1 RG2_
- [ ] **8.21** Pat, P`/bracket`. Reload. Expect: A draft again, with "The
      bracket changed, so some of your picks were cleared. Finish your bracket,
      then submit it". _P23 PS4 DC3 CV18.1_
- [ ] **8.22** Pat, P`/bracket`, opened before the move. Pick. Expect: "Couldn’t
      save. Reload the page to keep picking". _RP3_
- [ ] **8.23** Pat, terminal. Run `qa_fill 'Pat Q.'`, reload, and submit.
      Expect: "Bracket submitted". _P10_
- [ ] **8.24** Ada, Period 1 Chem. Read it. Expect: Pat, Rory, Sky, and Uma's
      submissions are in "Started, not submitted" until each submits again.
      _P23_
- [ ] **8.25** Ada, Period 1 Chem. Restore Wes X. from the trash, and make a new
      personal link for Wes. Expect: Wes is back. _P18 P7_
- [ ] **8.26** Nobody, terminal. Run the `qa_fill` lines in
      [Submissions for the results sections](#submissions-for-the-results-sections).
      Expect: Each prints `{ saved: true }` and its status. _P10 PS2_
- [ ] **8.27** Sky, P`/bracket`. Open Sky's personal link, change the champion,
      and don't submit. Expect: "Changes not submitted". _PS3_

## 9. First result, results, and leaderboards

Before the first step, open these in tabs and leave them: Ada's **Create
contest** dialog with a name typed, L's name form, Sky's P`/bracket`, and Uma's
P`/bracket`.

- [ ] **9.1** Grace, `/admin/results`. Read the Results bar. Expect: "0 of 64
      results", "Results save as you go", **Next battle to decide**, **Record a
      merge**, and above it "Press the same winner, or either side of a merge,
      again to clear the result.". _DV13 DY3_
- [ ] **9.2** Grace, that page. Press **Next battle to decide**. Expect: The
      battle has focus and an outline, after a mouse press too. _DR1_
- [ ] **9.3** Grace, that page. Press Addax Antelope in its Round 1 battle.
      Expect: "Lock submissions?", "This is the first 2025 result, and saving it
      locks submissions." _DR1 DT7_
- [ ] **9.4** Grace, that dialog. Press **Cancel**. Expect: "0 of 64 results"
      and Open. _DT7_
- [ ] **9.5** Grace, that page. Press the same side and **Save result and
      lock**. Expect: "Saved at", "In progress", "1 of 64 results", "Submissions
      are locked. Results can be corrected until the next bracket is
      published.", and no action under Phase. _DT7 DY4 DV14_
- [ ] **9.6** Ada, stale **Create contest** dialog. Press **Create contest**.
      Expect: "Submissions are closed, so this contest wasn’t created". _C1
      DX6c_
- [ ] **9.7** Nobody, stale name form. Press **Start my bracket**. Expect:
      "Submissions are closed, so no one can start a bracket". _P1_
- [ ] **9.8** Sky, stale P`/bracket`. Pick. Expect: "Submissions just closed.
      Couldn’t save" and **Reload**. _RP2_
- [ ] **9.9** Uma, stale P`/bracket`. Press **Submit changes** after a pick, or
      **Submit bracket**. Expect: "Submissions just closed. Couldn’t submit".
      _RP2 RP4_
- [ ] **9.10** Uma, that page. Press **Reload**. Expect: The marked bracket.
      _RP2_
- [ ] **9.11** Ada, `/contests`. Open it. Expect: "Submissions are closed. You
      can create contests again once the next bracket is published.",
      "Organization leaderboard", "Global leaderboard", and no **Copy link**.
      _CV1.4 CY3 DX1c_
- [ ] **9.12** Gia, `/contests`. Open it. Expect: "Global leaderboard" only.
      _CV1.4 CO1_
- [ ] **9.13** Ada, Period 1 Chem. Open it. Expect: "Submissions are closed. The
      contest link no longer starts brackets. You can still manage the players
      below.", "Leaderboard", a Score column, "Never submitted". _CV3.2 DX2c_
- [ ] **9.14** Ada, Period 5 Biology. Open it. Expect: "No one started a
      bracket." _CV3.2_
- [ ] **9.15** Ada, Period 5 Biology's leaderboard. Open it. Expect: "No
      approved brackets yet." _CV5_
- [ ] **9.16** Ada, Period 1 Chem's trash. Delete Quinn R., then open it.
      Expect: The status reads "Never submitted", the same as on the contest's
      page. Restore Quinn. _CV4_
- [ ] **9.17** Nobody, L. Open it. Expect: "Submissions are closed". _CV14.3
      DX4c_
- [ ] **9.18** Pat, L. Open it where Pat is remembered. Expect: "Continue as Pat
      Q.?" with **Not you?**. _CV14.2 P3_
- [ ] **9.19** Quinn, P`/bracket`. Ada makes Quinn a new personal link, and
      Quinn opens it. Expect: "Submissions closed before this bracket was
      submitted, so it doesn’t count" and the draft. _CV18.2 DX5c_
- [ ] **9.20** Uma, P`/bracket`. Open it. Expect: "Submissions are closed. Your
      bracket is in, and it counts once your educator approves it", and no
      ranks. _CV18.2_
- [ ] **9.21** Uma, P`/leaderboards/contest`. Open it. Expect: P`/bracket`.
      _CV20_
- [ ] **9.22** Rory, P`/bracket`. Ada makes Rory a new personal link, and Rory
      opens it. Expect: "Your educator didn’t approve your bracket. You can ask
      them about it". _CV18.2_
- [ ] **9.23** Sky, P`/bracket`. Open it. Expect: "The changes you made after
      submitting weren’t submitted." _CV18.2 PS3_
- [ ] **9.24** Pat, P`/bracket`. Open it. Expect: "Your bracket is in, and your
      educator approved it", "Score so far", "of 138 points", a tile for each
      round, and ranks for the contest, the organization, and everyone. _CV18.2
      CV20_
- [ ] **9.25** Pat, P`/bracket`, phone width. Press **Points by round**, which
      only phones have. Expect: A row for each round, with "right" counts or the
      points to win. _CV18.2_
- [ ] **9.26** Pat, P`/bracket`. Press **Done, forget my bracket here**, and
      confirm. Open the personal link again. Expect: "If you don’t have one, ask
      your educator for a personal link to the bracket you started.", without an
      offer to start a new one, then P`/bracket`. _P4 CV19 CN6_
- [ ] **9.27** Ada, Period 1 Chem's leaderboard. Open it. Expect: A podium of
      Pat and Sky, no table, and no **Report a name**. _CV5 DX3c_
- [ ] **9.28** Ada, that page. Press a name. Expect: "’s bracket" with the name,
      its rank, the scoreboard, marks, and "Champion pick" above the champion.
      _CV6_
- [ ] **9.29** Ada, that address. Change the player's ID to Uma's, then to `x`.
      Expect: "Page not found" each time. _CV6_
- [ ] **9.30** Cora, Period 2 Biology's leaderboard. Open it and send a report
      about the first row. Expect: "Thanks. Your report was sent". _RD3 CV5_
- [ ] **9.31** Cora, `/contests/years/2025/leaderboards/organization`. Open it.
      Expect: "2025 · Example High". Names of Period 2 (shared), and "Player
      from" with the contest and educator for the others. _CV11 CL6 CL8_
- [ ] **9.32** Cora, that page. Send a report. Expect: "Thanks. Your report was
      sent". _RD4_
- [ ] **9.33** Cora, that page. Open a row. Expect: The marked bracket. _CV12_
- [ ] **9.34** Cora, the leaderboard. Open a row labeled "Player from". Expect:
      The title is "Bracket of a player from" with the contest or organization,
      and no possessive. _CV12 CL8_
- [ ] **9.35** Ada, `/contests/years/2025/leaderboards/global`. Open it. Expect:
      "2025 · Everyone". Other organizations show "Player from" and the
      organization, and Gia's player shows "Player". _CV11 CL8_
- [ ] **9.36** Ada, `/contests/years/2025/leaderboards/nope`. Open it. Expect:
      `/contests`. _CV11_
- [ ] **9.37** Gia, `/contests/years/2025/leaderboards/organization`. Open it.
      Expect: `/contests`. _CV11_
- [ ] **9.38** Pat, P`/leaderboards/contest`. Open it. Expect: Pat's row has
      "You", with the names of the top 3 score tiers, and "Player" below them.
      _CV20 CL7_
- [ ] **9.39** Pat, P`/leaderboards/organization` and P`/leaderboards/global`.
      Open each and a row in each. Expect: The leaderboard and the marked
      bracket. _CV20_
- [ ] **9.40** Pat, P`/leaderboards/global`. Send a report. Expect: "Thanks.
      Your report was sent". _RD5_
- [ ] **9.41** Pat, P`/leaderboards/nope`. Open it. Expect: P`/bracket`, or
      "Page not found". _CV20_
- [ ] **9.42** Grace, `/admin/contests`. Hide Period 1 Chem, and Pat reloads
      P`/bracket`. Expect: "Not ranked" for the organization and everyone, with
      the contest's rank kept. _CV20 CS5_
- [ ] **9.43** Grace, that page. Show it again. Expect: Pat has 3 ranks. _DKA1_
- [ ] **9.44** Grace, terminal. Run the "No points" SQL and open Ada's contest
      leaderboard. Expect: No podium, and every row has 0. _CL1_
- [ ] **9.45** Grace, `/admin/results`. Press the decided winner, then
      **Cancel**. Record another result. Expect: Scores return, since each saved
      result scores every submission. _DT8_
- [ ] **9.46** Ada, Period 2's leaderboard. Run `qa_scores 90 80 70 60` and open
      it. Expect: Ava, Ben, and Jonah on the podium, and Priya in the table.
      _CP2 CL4_
- [ ] **9.47** Ada, that page. Run `qa_scores 90 90 80 70` and reload. Expect:
      Ranks 1, 1, and 3 on the podium. Both rank 1 steps look alike. _CP3 CL2_
- [ ] **9.48** Ada, that page. Run `qa_scores 90 80 80 70` and reload. Expect:
      Ranks 1, 2, and 2 on the podium, and rank 4 in the table. _CP4_
- [ ] **9.49** Ada, that page. Run `qa_scores 90 80 70 70` and reload. Expect:
      Ranks 1 and 2 on the podium, and both rank 3 rows in the table. _CP5 CL4_
- [ ] **9.50** Ada, that page. Run `qa_scores 70 70 70 70` and reload. Expect:
      No podium, and 4 rows of rank 1. _CP6_
- [ ] **9.51** Ada, that page. Run `qa_scores 90 80 0 0` and reload. Expect: 2
      steps, and both rows without points in the table. _CP7 CL1_
- [ ] **9.52** Ada, that page. Run the "Earlier time" SQL after
      `qa_scores 70 70 60 50` and reload. Expect: Ben is rank 1 and Ava rank 2,
      because Ben's picks changed first, and "Ties go to whoever finished their
      picks first." _CL3_
- [ ] **9.53** Ada, Period 2. Reject Ben, Jonah, and Priya, and open the
      leaderboard. Expect: 1 step, and no table. _CP1_
- [ ] **9.54** Ada, Period 2. Approve the 3 again. Expect: 4 rows. _P14_
- [ ] **9.55** Grace, `/admin/results`. Press the empty side of "Sweet 16,
      battle 1" and pick a name. Expect: The menu says "Choose who gets here.
      Their earlier wins are recorded too", and the count grows by more than 1.
      _DR2 DT8_
- [ ] **9.56** Grace, that page. Press the winner of a Round 1 battle with later
      results. Expect: "Clear this result?" with the later results it clears and
      "Submissions stay locked." _DR3_
- [ ] **9.57** Grace, that dialog. Press **Clear result**. Expect: "Also
      cleared" with the count and battles. _DR3 DT8_
- [ ] **9.58** Grace, that page. Decide a battle, then press its other side.
      Expect: "Change this result?", with the new name "instead of" the old, and
      **Change result**. _DR4_
- [ ] **9.59** Grace, that page. Go offline and record a result. Expect:
      "Couldn’t save the result" and **Try again**. _DT8_
- [ ] **9.60** Grace, that page. Go online and press **Try again**. Expect:
      "Saved at". _DT8_
- [ ] **9.61** Grace, two tabs, that page. Record a battle one way in the first
      tab, then the other way in the second. Expect: Second tab: "Couldn’t save
      the result. Reload the page" with **Reload**, and the refused result and
      its count are gone. _DT8 RG9 RG2_
- [ ] **9.62** Grace, that page. Press **Record a merge** and clear **Combined
      name**. Expect: "Enter the combined name". _DR5_
- [ ] **9.63** Grace, that dialog. Enter 81 characters, then `sun bear`. Expect:
      "Shorten the combined name to 80 characters or fewer", then "sun bear is
      already a combatant. Give each combatant its own name". _DR5_
- [ ] **9.64** Grace, that dialog. Choose a Round 1 battle, keep the suggested
      name, and press **Record merge**. Expect: Both sides advance, and a
      "Merges" group is under Combatants. _DR5 DV17_
- [ ] **9.65** Grace, that page. Rename the merge under "Merges". Expect: The
      row shows the new name and "Saved". _DC1 DV17 RG12_
- [ ] **9.66** Grace, that page. Record the next battle as a merge of that
      merge, then press either side of the inner one. Expect: "Clear this
      result?", and "This also clears 1 later result" with the outer one. _DR8
      DR6_
- [ ] **9.67** Grace, that dialog. Press **Clear result**. Expect: Both merges
      leave "Merges", and neither battle has a result. _DR8 RG10_
- [ ] **9.68** Grace, that page. Merge a battle again, then press either side of
      it. Expect: "Clear this result?" instead of "Change this result?". _DR7
      RG10_
- [ ] **9.69** Grace, that dialog. Press **Clear result**. Expect: No result in
      that battle after one press and confirmation, and the merge leaves
      "Merges". _DR6 RG10_
- [ ] **9.70** Grace, that page. Decide the wild card, and look at **Record a
      merge** with 3 or 4 entrants. Expect: Only a wild card with 2 entrants can
      merge. 2025's has 2. _DR5_
- [ ] **9.71** Pat, P`/bracket`. Reload after a merge of a side Pat picked.
      Expect: The pick counts as right. _DR5_
- [ ] **9.72** Grace, `/admin/results`. Move 2 combatants of undecided and
      decided battles. Expect: "Submissions are locked, so those picks in" with
      a count, and "It also clears" with the results. _DC2 DC4_
- [ ] **9.73** Pat, P`/bracket`. Reload. Expect: The status is kept, the score
      is less, and "The bracket changed after submissions closed, so some of
      your picks were cleared". _P24 DC4 CN5_
- [ ] **9.74** Quinn, P`/bracket`. Reload, when the move cleared some of Quinn's
      picks. Expect: "The bracket changed, so some of your picks were cleared".
      _CN5_
- [ ] **9.75** Ada, Period 1 Chem. Approve Uma, reject Uma, approve again,
      rename, delete, and restore Uma. Expect: Each works while locked. _P14 P15
      P8 P16 P18 CY3_
- [ ] **9.76** Uma, P`/bracket`. Press **Delete my bracket**, read, and cancel.
      Expect: ", and submissions are closed, so you can’t submit again". _P17_
- [ ] **9.77** Ada, `/contests/reports`. Open a report's "See the contest".
      Expect: The contest. _CV13_

## 10. Clearing every result, and reopening

- [ ] **10.1** Grace, `/admin/results`. Clear every result, starting from the
      latest round. Expect: "0 of 64 results", "Submissions are locked, though
      no results are saved.", **Reopen submissions**, In progress. _DY5 DV15 CY4
      DT8_
- [ ] **10.2** Ada, `/contests`. Reload. Expect: "Submissions are closed. You
      can create contests again once the next bracket is published." _CY4_
- [ ] **10.3** Nobody, L. Open it. Expect: "Submissions are closed", "No one can
      start a bracket anymore. If you already have one, open your personal
      link." _CV14.3_
- [ ] **10.4** Grace, two tabs, `/admin/results`. Record a result in the first
      tab. In the second press **Reopen submissions**, then confirm in "Reopen
      submissions?". Expect: "Clear every result before reopening submissions".
      The dialog stays open, with the error and **Reload** below its buttons.
      _DT9 RG1 RG2_
- [ ] **10.5** Grace, first tab. Clear the result, then reopen. Expect: "Open".
      _DT9 CY5_
- [ ] **10.6** Grace, second tab. Press **Reopen submissions** and confirm.
      Expect: "Submissions aren’t locked. Reload the page". The dialog stays
      open, with the error and **Reload** below its buttons. _DT9 RG1 RG2_
- [ ] **10.7** Grace, second tab. Press **Reload**. Expect: "Open", without
      **Reopen submissions**. _RG2_
- [ ] **10.8** Pat, P`/bracket`. Reload. Expect: A draft, with "The bracket
      changed, so some of your picks were cleared. Finish your bracket, then
      submit it". _P25 CY5_
- [ ] **10.9** Ada, `/contests`. Reload. Expect: **Create contest** is back.
      _CY5 CV1.3_
- [ ] **10.10** Pat, terminal. Run the `qa_fill` lines again. Expect:
      `{ saved: true }` for each. _P10_
- [ ] **10.11** Ada, `/contests`. Create `Period 9 Late` and delete it, leaving
      it in the trash. Expect: "Deleted contests (1)". _C4_
- [ ] **10.12** Grace, `/admin/results`. Enter an expected lock date in the
      past, and open `/`, `/bracket`, `/admin`, `/contests`, and P`/bracket`.
      Expect: No "expected to lock" anywhere. _DT6 DM19 RG7_

## 11. The champion

- [ ] **11.1** Grace, `/admin/results`. Press the empty sides of "Championship"
      for each Final Roar battle, pick a name in each, and confirm the lock.
      Expect: "In progress", and both sides are known. _DR2 DT7_
- [ ] **11.2** Grace, that page. Press Thorold’s Deer, or any side, in
      "Championship". Expect: "Complete", the champion with "won, and", the
      count with "of 64 results are saved. Results can be corrected until the
      next bracket is published." _DM15 DT10 DY6 DV16_
- [ ] **11.3** Grace, `/admin`. Open it. Expect: The 2025 card: "Champion:" and
      **Correct 2025 results**, and the 2027 card with **Manage the 2027
      bracket** or **Set up the 2027 bracket**. _DV4 DT10_
- [ ] **11.4** Pat, P`/bracket`. Reload. Expect: "Score so far" with "still
      possible" while battles are undecided, and "Final score" without it once
      every battle is. _CV18.2_
- [ ] **11.5** Grace, `/admin/results`. Press the Championship's winner, then
      **Clear result**. Expect: "In progress", and `/admin` has no 2027 card.
      _DT11_
- [ ] **11.6** Grace, two tabs, `/admin/bracket`. Record the champion. Open
      `/admin/bracket` in both. If there's no 2027 bracket, paste `qa_names` and
      save it. Expect: "2027 bracket", Setup. _DT1 DV7_
- [ ] **11.7** Grace, first tab. Press **Publish 2027 bracket** and read.
      Expect: "2025 becomes read-only, and" the count "of 64 results are saved.
      Everything in its trash, and every bracket its players never submitted, is
      deleted forever. Unpublishing doesn’t bring it back." _DV8 DM15_
- [ ] **11.8** Grace, first tab, `/admin/results`. Cancel. Clear the champion
      there. Expect: "In progress". _DT11_
- [ ] **11.9** Grace, second tab. Press **Publish 2027 bracket** and confirm.
      Expect: "The 2027 bracket can’t be published now. Reload the page". The
      dialog stays open, with the error and **Reload** below its buttons. _DT4
      RG1 RG2_
- [ ] **11.10** Grace, that tab. Look at the page. Expect: `/admin/bracket`, and
      not `/admin/results`. _RG1_
- [ ] **11.11** Grace, `/admin/results`. Record the champion again. Record other
      battles until the bar says "64 of 64 results". Expect: No **Next battle to
      decide** and no **Record a merge**. _DT10 DR1_
- [ ] **11.12** Grace, `/admin/bracket`. Change a name in the form without
      saving, and press **Publish 2027 bracket**. Expect: "This publishes the
      saved bracket, without unsaved changes in the form." Cancel. _DV8_

## 12. Publishing the next year

This section can't be undone. Before it, do every step above that needs 2025
open or locked. Leave these open in tabs: Ada's Period 1 Chem with the
**Rename** form open, its **Share** form, and its **Delete contest** dialog,
Otto Zoology's Olga at P`/bracket`, and Quinn's P`/bracket`.

- [ ] **12.1** Wes, P`/bracket`. Open Wes's personal link. Press **Delete my
      bracket** and confirm. Expect: "ask your educator to restore it within 7
      days, or before next year’s bracket is published, if that’s sooner". _P17
      PS6_
- [ ] **12.2** Grace, `/admin/bracket`. Press **Publish 2027 bracket** and
      confirm. Expect: `/admin/results`: "2027 bracket", "Open". _DT4 DT12 DY3
      DY7 CY6_
- [ ] **12.3** Wes, personal link. Open it. Expect: "This link doesn’t work",
      since next year's bracket came sooner. _P21_
- [ ] **12.4** Ada, `/contests`. Open it. Expect: "2027", "Create a contest", no
      "Deleted contests", and **Past years**. _C8 CV1.2 DX1d CY2_
- [ ] **12.5** Quinn, stale P`/bracket` and personal link. Reload the first and
      open the second. Expect: "This device forgot your bracket" with "A bracket
      you never submitted was deleted once the next year’s bracket was
      published.", then "This link doesn’t work". _P21 DX5d AV57 CN6_
- [ ] **12.6** Ada, stale **Rename** form. Press **Save**. Expect: "This
      contest’s name wasn’t saved. Reload the page". _C2_
- [ ] **12.7** Ada, stale share form. Press **Share contest**. Expect: "This
      contest wasn’t shared. Reload the page". _C9_
- [ ] **12.8** Ada, stale **Delete contest** dialog. Press **Delete contest**.
      Expect: "This contest wasn’t deleted. Reload the page". The dialog stays
      open, with the error and **Reload** below its buttons. _C4 RG1 RG2_
- [ ] **12.9** Ada, that tab. Look at the page behind the dialog. Expect: Period
      1 Chem as it was, and not the past year's page. _RG1_
- [ ] **12.10** Ada, that tab. Press **Reload**. Expect: The past year's
      read-only page. _RG2_
- [ ] **12.11** Grace, `/admin/results`. Read it. Expect: **Unpublish** and
      "Possible until an educator creates a contest". _DV12_
- [ ] **12.12** Grace, that page. Press **Unpublish** and confirm. Expect:
      `/admin/bracket` with Setup, 2025 is current on `/contests`, and its trash
      stays empty. _DT5 DY2_
- [ ] **12.13** Grace, `/admin/bracket`. Publish 2027 again. Expect: "Open".
      _DT4_
- [ ] **12.14** Grace, `/admin/results`, 2 tabs. Record the first 2027 result in
      the first. In the second press **Save date**. Expect: "The 2027 bracket is
      locked or deleted. Reload the page". _DT6_
- [ ] **12.15** Grace, second tab. Press **Unpublish** and confirm. Expect:
      "Submissions are locked, so the 2027 bracket stays published. Reload the
      page". The dialog stays open, with the error and **Reload** below its
      buttons. _DT5 RG1 RG2_
- [ ] **12.16** Grace, first tab. Clear the result and reopen. Expect: "Open".
      _DT9_
- [ ] **12.17** Ada, `/contests`. Create `Period 1 Next`. Expect: The contest's
      page with "2027 contest". _C1_
- [ ] **12.18** Grace, stale `/admin/results` with **Unpublish** showing. Press
      **Unpublish** and confirm. Expect: "Educators have created 2027 contests,
      so the bracket stays published. Reload the page". The dialog stays open,
      with the error and **Reload** below its buttons. _DT5 RG1 RG2_
- [ ] **12.19** Grace, stale 2025 `/admin/results`. Record or clear a result.
      Expect: "Couldn’t save the result. Reload the page" with **Reload**, and
      the count stays as saved. _DT8 DY7 RG9_
- [ ] **12.20** Grace, stale 2025 `/admin/results`. Rename a combatant, then a
      division. Expect: "The 2025 bracket isn’t current. Reload the page". _DC1
      DM8_
- [ ] **12.21** Nobody, `/`. Open it signed out. Expect: "2027 bracket" and no
      "MMMM adds" line. _AV3 DV27_

## 13. A past year

- [ ] **13.1** Ada, `/contests/past`. Press **Past years**. Expect: "2025",
      "Champion:" with the name, "Bracket and leaderboards", and contests such
      as "4 submissions". _CV9_
- [ ] **13.2** Cora, `/contests/past`. Open it. Expect: Period 2 Biology with
      "Shared by Ada Byron". _CV9_
- [ ] **13.3** Grace, `/admin`. Press **Past years**. Expect: The same page for
      Grace. _DV5_
- [ ] **13.4** Ada, `/contests/years/2025`. Press **Bracket and leaderboards**.
      Expect: The banner "2025 is over." with **Go to 2027**, "2025 bracket",
      and the leaderboard links. _CV10 CY6 DX3d_
- [ ] **13.5** Ada, that page. Press **Go to 2027**. Expect: `/contests`. _CV10_
- [ ] **13.6** Ada, `/contests/years/2025/leaderboards/organization`. Open it
      and a row. Expect: The leaderboard and a marked bracket under the banner.
      _CV11 CV12 DX3d_
- [ ] **13.7** Ada, Period 1 Chem. Open it. Expect: The banner "2025 is over.
      Its contests can’t be edited anymore.", read-only sections, "Leaderboard",
      and no "Trash" link, since publishing emptied it. _CV3.3 DX2d_
- [ ] **13.8** Ada, Period 5 Biology. Open it. Expect: "No one started a
      bracket.", and no "Shared with". _CV3.3_
- [ ] **13.9** Ada, Period 2 Biology. Press **Stop sharing** and confirm.
      Expect: "No colleague can see this contest anymore." _C10_
- [ ] **13.10** Ada, Period 1 Chem's trash. Open it, and open it again in 13.11
      before restoring Uma. Expect: "The trash is empty.", then Uma's bracket
      with "Deleted by player", "Restore it by" and the date, and "You can
      restore each bracket until the date beside it." _CV4 CN10_
- [ ] **13.11** Uma, P`/bracket`. Press **Delete my bracket**. The dialog says
      "within 7 days. After that it’s deleted forever.", without next year's
      bracket. Delete Uma's bracket from the personal link, and Ada restores Uma
      in the past year. Expect: Uma is back. _P17 P18_
- [ ] **13.12** Uma, P`/bracket`. Delete again, and Ada presses **Delete
      forever**. Expect: Uma's link says "This link doesn’t work". _P19 PS7_
- [ ] **13.13** Pat, P`/bracket`. Open the personal link. Expect: The banner
      with **Go to 2027**, and the marked bracket. _CV18.3 DX5d_
- [ ] **13.14** Pat, that page. Press **Go to 2027**. Expect: `/bracket`
      with 2027. _CV18.3_
- [ ] **13.15** Olga, P`/bracket`. Open the personal link. Expect: "Your
      educator didn’t approve your bracket in time, so it doesn’t count".
      _CV18.2 CV18.3_
- [ ] **13.16** Nobody, L of Period 1 Chem. Open it. Expect: "Submissions are
      closed". _DX4d CV14.3_
- [ ] **13.17** Grace, `/admin/contests`. Hide and show Period 1 Chem, and hand
      over Otto Zoology to Gia. Expect: Both work in a past year, and the dialog
      says "with all its brackets". _DKA1 DKA2 C13_
- [ ] **13.18** Grace, `/admin/contests/:id`. Press **Delete forever** on Pat Q.
      in Period 1 Chem and confirm. Expect: The row leaves, and Pat's link says
      "This link doesn’t work". _DKA3 P22 PS7 RS6_

## 14. Forced states

- [ ] **14.1** Nobody, terminal. Run "Expire links", then open any unused
      confirmation, reset, setup, or address link. Expect: Each shows its
      expired notice. _AE8 AE9 AV20 AV26 AV42_
- [ ] **14.2** Nobody, `/sign-in/code`. Sign in as Grace, run "Expire links",
      and enter the right code. Expect: "Your sign-in timed out before the code
      was accepted. Sign in again", though the cookie's 10 minutes can end it
      first. _AX5 AS2_
- [ ] **14.3** Ada, terminal. Run "Expire sessions", then reload `/contests`.
      Expect: `/sign-in`. _AS7_
- [ ] **14.4** Nobody, terminal. Run `pnpm job:daily`. Expect: "Daily job:
      delete expired sessions and links" with a count over 0. _DJ2 AS7_
- [ ] **14.5** Wes, terminal. Submit a bracket in Period 1 Next, delete it as
      the player, run "Delete 8 days ago", then `pnpm job:daily`. Expect: "Daily
      job: erase brackets their players deleted (1)", and the personal link says
      "This link doesn’t work". _P20 DJ1 PS7_
- [ ] **14.6** Nobody, terminal. Run "Two years later, unlocked". Expect: The
      names stay. _DJ4_
- [ ] **14.7** Nobody, terminal. Run "Two years later". Expect: "Daily job:
      remove display names two years after their tournament" with a count
      over 0. _P26 PS8 DJ3 RS6_
- [ ] **14.8** Ada, Period 2 Biology. Open it. Expect: Every name is "Player",
      and reports of those names are gone. _P26 PS8_
- [ ] **14.9** Ada, `/contests/years/2025/leaderboards/organization`. Run
      "Server on May 2, 2027" and sign in. Expect: Rows labeled "Player" have no
      **Report a name**, since their names were removed. _RD4_
- [ ] **14.10** Nobody, terminal. Run "Break one step of the daily job". Expect:
      "Daily job failed:" for one step, and lines for the others. _DJ5_
- [ ] **14.11** Nobody, server log. Restart the server. Expect: 3 "Daily job:"
      lines at start. _DJ6_
- [ ] **14.12** Nobody, server log. Start the server with "Two in the morning"
      and wait 1 minute. Expect: 3 "Daily job:" lines at start and 3 more at
      02:00 in Arizona. _DJ7_
- [ ] **14.13** Grace, terminal. Run "Stranded bracket", sign in, then open
      `/admin`. Expect: **Manage the 2027 bracket**, and no 2028 card. _DY8
      DM16_
- [ ] **14.14** Grace, `/admin/bracket`. Open it. Expect: "The 2027 tournament
      is over. To set up the 2028 bracket, delete this one below." The page
      doesn't say "Enter the combatants". _DM16_
- [ ] **14.15** Nobody, `/`. Open it signed out on that server. Expect: "MMMM
      adds the 2028 bracket once ASU publishes it in late February." _DM16_
- [ ] **14.16** Ada, terminal. Run "120 approved players" and open the global
      and organization leaderboards. Expect: "Page 1 of 2", **Next**. The next
      page has **Previous** and no podium. `?page=999` shows the last. _CL5
      CV11_
- [ ] **14.17** Grace, terminal. Run "101 contests" and open `/admin/contests`.
      Expect: "Page 1 of 2". _DV21_
- [ ] **14.18** Grace, terminal. Run "101 reports" and open `/admin/reports`.
      Expect: "Page 1 of 2". _DV19_
- [ ] **14.19** Nobody, terminal. Run "301 players". Expect: "Too many new
      brackets right now. Try again in 60 minutes". _P1_
- [ ] **14.20** Nobody, terminal. Run "101 reports from one address". Expect:
      "Too many reports right now. Try again in". _R1_
- [ ] **14.21** Nobody, terminal. Run "10,000 requests". Expect: `429` and "Too
      many requests right now. Try again in 1 minute". _AL4_
- [ ] **14.22** Nobody, `/sign-in`. Enter a wrong password for
      `cora@example.com` 11 times. Expect: "Too many attempts. Try again in"
      with the minutes. _AL1_
- [ ] **14.23** Grace, `/settings`. Enter a wrong password 5 times under
      Password and 4 times under "Authenticator app", then the right one under
      "Authenticator app" with **Get new recovery codes**. Expect: New codes.
      _AK2_
- [ ] **14.24** Grace, `/settings`. Restart the server. Enter a wrong password 6
      times under Password, then 5 times under "Authenticator app". Expect: The
      last says "Too many attempts. Try again in" with the minutes, since every
      password prompt shares one count. _AL1 AL7 AV34 AK1_
- [ ] **14.25** Nobody, `/forgot-password`. Request a reset for one address 4
      times. Expect: "Too many attempts. Try again in". _AL2_
- [ ] **14.26** Nobody, "Check your email" page. Press **Resend email** 4 times.
      Expect: "Too many attempts. Try again in". _AL2 AT7_
- [ ] **14.27** Grace, `/admin/educators`. Send an address change for Cora to
      one new address 11 times. Expect: "This address got too many emails. Try
      again in an hour", and the last link that was sent still works. _AL3 AV51
      DE1_
- [ ] **14.28** Grace, `/admin/setup`. Run "Remove second factors", restart,
      sign in, and press **Email me a setup link**, then **Send again** 10
      times. Expect: The last says "This address got too many emails. Try again
      in an hour". _AL3 AV41_
- [ ] **14.29** Cora, mailbox. Sign up with `taken@moved.example` after Grace
      sends an address change there, and open the sign-up's confirmation link.
      Then open the change's link and press **Confirm email address**. Expect:
      "This address already has an account", "Your account keeps its old
      address. Sign in with it, or email" with the support address, and "Go to
      the home page". _AV26 DE2 AK11_
- [ ] **14.30** Grace, `/admin/bracket`. Set 2027 aside with "Hide 2027" and
      "Move Period 1 Next to 2025", since a bracket with contests can't be
      saved. Then run "Make the second factor stale" with a filled form open,
      and press **Save bracket** or **Save changes**. Expect: "The admin area
      needs your second factor again. Open the admin area in another tab, use
      your second factor there, then save here again", and every typed name
      stays. _AX11 AV47 AV48 DM14_
- [ ] **14.31** Grace, `/admin/bracket`. Sign out in another tab, then press
      **Save bracket** or **Save changes**. Expect: "You’re signed out. Sign in
      again in another tab, then save here again", and every typed name stays.
      _DM14_
- [ ] **14.32** Grace, that page. Sign in with a code in the other tab, then
      save. Expect: `/admin`. _DM14_
- [ ] **14.33** Grace, terminal. Run "Show 2027 again" and "Move Period 1 Next
      back". Expect: `UPDATE 1` twice. _CY2_
- [ ] **14.34** Grace, 2 tabs, `/settings`. With 2 passkeys, remove both at the
      same moment. Manual. Expect: One stays. _AF7_
- [ ] **14.35** Grace, `/settings`, with "Add a passkey" showing. Restart with
      `ADMIN_LIST=other@example.com` and press **Add a passkey** in the open
      page. Expect: "Only admins add second factors". _AF8 AT15_
- [ ] **14.36** Grace, `/sign-in`. Sign out, sign in with the app's code, and
      open `/admin` and `/settings`. Expect: "Page not found". Settings has
      "Second factor" with **Turn off** and nothing to add. _AE7 AF8 AT15 AV30
      AV33_
- [ ] **14.37** Grace, `/settings`. Run "Make the second factor stale" and
      reload. Expect: "Sign in with your passkey or authenticator app before
      changing these". _AV32 AF8_
- [ ] **14.38** Grace, `/settings`. Sign in with a code again and press **Turn
      off**. Expect: "You have no second factor now. You sign in with only your
      password". The section leaves when the page reloads. _AF8 AG6_
- [ ] **14.39** Grace, terminal. Restart with `ADMIN_LIST=admin@example.com` and
      open `/admin`. Expect: `/admin/setup`. _AT16 AE6_
- [ ] **14.40** Nobody, terminal. Close `mmmm_qa` with "Database outage", then
      open `/` and `/healthz`. Expect: "Something went wrong", "Reload the page
      to try again. If it keeps happening, email", "Go to the home page", and a
      stack, since the server runs in development. `/healthz` answers 503 with
      `{"database":"down"}`. _AV55 AV60 AK14_
- [ ] **14.41** Ada, `/contests` while the database is closed. Open it signed
      in. Expect: "Something went wrong", a header with neither a name nor
      **Sign in**, and a footer without the support address. _AV56_
- [ ] **14.42** Nobody, terminal. Open it again. Expect: `/healthz` answers 200
      with `{"database":"up"}`. _AV60_
- [ ] **14.43** Nobody, terminal. Run "Cross-origin request". Expect:
      `Cross-origin request rejected403`. _AV58_
- [ ] **14.44** Nobody, terminal. Run "Auth endpoints". Expect: 404 with no body
      for the endpoint that isn't public, and another status for the public one.
      _AV61_
- [ ] **14.45** Nobody, terminal. Start a second server as "Staging", and open
      it. Expect: Chrome asks for a password. Cancel it: "Staging requires a
      password". Any username with `qa` opens the site. _AV59_
- [ ] **14.46** Nobody, terminal. Wait a minute, then run "Wrong staging
      passwords". Expect: 30 times 401, then 429. _AL5_
- [ ] **14.47** Nobody, staging server's `/dev/mailbox`. Open it. Expect: "Page
      not found". _AV53_
- [ ] **14.48** Nobody, mailbox. Restart the server and open `/dev/mailbox`.
      Expect: "No emails yet. Signing up sends one." _AV53 AM1_
- [ ] **14.49** Grace, `/admin/educators`. Find the imported educator, and
      request a reset at `/forgot-password` for the address. Expect: An email
      "Reset your MMMM password" whose link sets a password and confirms the
      address. _DI3 DI7 DES3_
- [ ] **14.50** Imported, that link. Set a password and sign in. Expect:
      `/contests` with imported.example. _DI5 AT8 AE4_
- [ ] **14.51** Grace, terminal. Run the "Launch email sent" SQL on an imported
      educator. Expect: Nothing in the app shows the difference, and Forgot
      password still works. _DI4_
- [ ] **14.52** Grace, `/admin/organizations`. Delete example.com's data as an
      admin whose address is elsewhere, or delete moved.example's. Expect: The
      row leaves, with its educators and contests. _DO6_
- [ ] **14.53** Grace, `/admin/educators`. Ada shares Period 1 Next with Cora.
      Then Grace changes Cora's address to another domain, and Cora confirms it.
      Expect: Period 1 Next leaves Cora's "Shared with you". _C11_
- [ ] **14.54** Ada, `/contests/reports`. Open Period 1 Next's list in 2 tabs,
      dismiss a report in the first, then in the second. Expect: "This report is
      gone. Reload the page". _R3 DN4_
- [ ] **14.55** Grace, `/admin/reports`. Do the same. Expect: "This report is
      gone. Reload the page". _DN4_

## 15. Stale tabs

Each row opens the page in 2 tabs, changes something in the first, then acts in
the second. Use 2027 while it's open, with a contest that has 3 submissions from
`qa_fill`.

- [ ] **15.1** Ada, contest, 2 tabs. Delete the contest in the first. In the
      second, **Rename** and **Save**. Expect: "This contest’s name wasn’t
      saved. Reload the page". _C2_
- [ ] **15.2** Ada, second tab. **Replace contest link** and confirm. Expect:
      "The contest link wasn’t replaced. Reload the page". The dialog stays
      open, with the error and **Reload** below its buttons. _C3 RG1 RG2_
- [ ] **15.3** Ada, second tab. **Share contest**. Expect: "This contest wasn’t
      shared. Reload the page". _C9_
- [ ] **15.4** Ada, second tab. **Delete contest** and confirm. Expect: "This
      contest wasn’t deleted. Reload the page". The dialog stays open, with the
      error and **Reload** below its buttons. _C4 RG1 RG2_
- [ ] **15.5** Ada, `/contests/trash`, 2 tabs. Restore in the first, then
      restore in the second. Expect: "Nothing was restored. Reload the page and
      try again", with **Reload** beside it, and the row stays. _C5 RG1 RG2_
- [ ] **15.6** Ada, `/contests/trash`, 2 tabs. Delete forever in the first, then
      in the second. Expect: "Nothing was deleted. Reload the page and try
      again", with **Reload** beside it, and the row stays. _C6 RG1 RG2_
- [ ] **15.7** Ada, contest, 2 tabs. Stop sharing in the first, then in the
      second. Expect: "This contest is no longer shared with them. Reload the
      page". The dialog stays open, with the error and **Reload** below its
      buttons. _C10 RG1 RG2_
- [ ] **15.8** Ada, contest, 2 tabs. Delete a player in the first. In the second
      **Approve** the player. Expect: The player's name and "This bracket wasn’t
      changed. Reload the page", with **Reload** beside it, and the row stays.
      _P14 P15 RG1 RG2_
- [ ] **15.9** Ada, second tab. Rename the player. Expect: "This player’s name
      wasn’t saved. Reload the page". _P8_
- [ ] **15.10** Ada, second tab. Delete the player. Expect: "Nothing was
      deleted. Reload the page and try again", with **Reload** beside it, and
      the row stays. _P16 RG1 RG2_
- [ ] **15.11** Ada, contest trash, 2 tabs. Restore a player in the first, then
      in the second. Expect: "Nothing was restored. Reload the page and try
      again", with **Reload** beside it, and the row stays. _P18 RG1 RG2_
- [ ] **15.12** Ada, contest trash, 2 tabs. Delete forever in the first, then in
      the second. Expect: "Nothing was deleted. Reload the page and try again",
      with **Reload** beside it, and the row stays. _P19 RG1 RG2_
- [ ] **15.13** Ada, contest, 2 tabs. Sign out in the first, then press
      **Approve** in the second. Expect: `/sign-in`. _AX13_
- [ ] **15.14** First, L, tab 1. Start as `First F.` and pick a battle. Expect:
      "1 of 64 picked". _P1_
- [ ] **15.15** Second, L, tab 2. Press **Not you? Start a new bracket** and
      start as `Second S.`. Expect: "0 of 64 picked". _P3_
- [ ] **15.16** First, tab 1. Pick a battle. Expect: "Couldn’t save. This device
      opens another player’s bracket now. Ask your educator for your personal
      link to go back to yours". _RP3 PT1_
- [ ] **15.17** First, tab 1, DevTools, Network. Look at that request. Expect:
      409, with no `Set-Cookie`. _PT8_
- [ ] **15.18** Second, tab 2. Reload. Expect: "0 of 64 picked", because First's
      pick changed nothing. _P9 PT1_
- [ ] **15.19** Ada, the contest. Make new personal links for First and Second,
      and keep both. Expect: 2 links. _P7_
- [ ] **15.20** First, tab 1. Run `qa_fill 'First F.'` and open First's link in
      tab 1, then Second's link in tab 2. Press **Submit bracket** in tab 1.
      Expect: "Couldn’t submit. This device opens another player’s bracket now.
      Ask your educator for your personal link to go back to yours". _PT3_
- [ ] **15.21** First, tab 1. Run `qa_fill 'First F.' PENDING`, open First's
      link in tab 1, and change the champion. Expect: "Changes not submitted".
      _PS3_
- [ ] **15.22** First, tab 1. Open Second's link in tab 2. Press **Discard
      changes** in tab 1 and confirm. Expect: "Couldn’t discard your changes.
      This device opens another player’s bracket now. Open your personal link to
      go back to yours". The bar says "Changes not submitted". _PT4_
- [ ] **15.23** First, tab 1. Pick a battle. Expect: "Couldn’t save. This device
      opens another player’s bracket now. Open your personal link to go back to
      yours". _PT2_
- [ ] **15.24** First, tab 1. Open First's link in tab 1, then Second's in
      tab 2. Press **Done, forget my bracket here** in tab 1, then **Forget my
      bracket**. Expect: "This device already forgot your bracket, and opens
      another player’s now". _PT5_
- [ ] **15.25** First, tab 1. Press **Delete my bracket** and confirm. Expect:
      "Your bracket wasn’t deleted. Open your personal link, or ask your
      educator for one, and try again". _P17 PT6_
- [ ] **15.26** Second, second tab, dialog "Delete your bracket?". Delete the
      hidden `playerId` input in DevTools and press **Delete my bracket**.
      Expect: "Your bracket wasn’t deleted. Reload the page and try again". The
      dialog stays open, with the error and **Reload** below its buttons. _PT7
      RG1 RG2_
- [ ] **15.27** Second, second tab, dialog "Forget your bracket on this
      device?". Delete the hidden `playerId` input in DevTools and press
      **Forget my bracket**. Expect: "Your bracket wasn’t forgotten. Reload the
      page and try again". The dialog stays open, with the error and **Reload**
      below its buttons. _PT7 RG1 RG2_
- [ ] **15.28** Second, second tab, Chrome's console. Run
      `(await fetch(location.pathname + '/picks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent: 'discard' }) })).status`.
      Expect: 400. _PT7_
- [ ] **15.29** Olga, an orphaned or past contest, 2 tabs. Open Olga's and
      Omar's personal links in 2 tabs, then delete in the first. Expect: "Your
      bracket wasn’t deleted. Open your personal link and try again". _PT9_
- [ ] **15.30** Pat, P`/bracket`, 2 tabs. Pick in each. Expect: Both save, and
      the last one wins. _P9_
- [ ] **15.31** Pat, P`/bracket`, 2 tabs. Delete the bracket in the first, then
      pick in the second. Expect: P`/forgotten`, or "Couldn’t save. Reload the
      page to keep picking". _RP3_
- [ ] **15.32** Nobody, L, 2 tabs. Ada replaces the contest link, then press
      **Start my bracket** in the stale tab. Expect: "This link doesn’t work".
      _P1 C3_
- [ ] **15.33** Nobody, L, report dialog open. Ada deletes the contest, then
      press **Send report**. Expect: "Your educator deleted this contest". _R1_
- [ ] **15.34** Grace, `/admin/contests`, 2 tabs. Ada deletes a contest, then
      press **Hide** and confirm in the stale tab. Expect: "This contest can’t
      be hidden or shown now. Reload the page". The dialog stays open, with the
      error and **Reload** below its buttons. _DKA1 RG1 RG2_
- [ ] **15.35** Grace, `/admin/contests/:id`, 2 tabs. Press **Delete forever**
      on a player in the first, then in the second. Expect: "This bracket is
      gone. Reload the page". The dialog stays open, with the error and
      **Reload** below its buttons. _DKA3 RG1 RG2_
- [ ] **15.36** Grace, `/admin/educators`, 2 tabs. Delete an account in the
      first. In the second press **Change address** and send. Expect: "This
      account is gone. Reload the page". _AV51 DE1_
- [ ] **15.37** Grace, second tab. **Delete account** and type the address.
      Expect: "This account is gone. Reload the page". _AT12 AK12_
- [ ] **15.38** Grace, `/admin/results`, 2 tabs. Press **Rename** on a
      combatant, change the hidden `combatantId` to `x` in DevTools, and press
      **Save**. Expect: "This combatant isn’t in the 2027 bracket. Reload the
      page". _DC1_
- [ ] **15.39** Ada, `/settings`, 2 tabs. Delete the account's session by
      signing out others elsewhere, then **Save name** in this tab. Expect:
      `/sign-in`. _AX13_

## 16. Cross-cutting checks

### Addresses, signed out, as the wrong role, and with a bad ID

- [ ] **16.1** Nobody, `/contests`, `/contests/past`, `/contests/trash`,
      `/contests/reports`, `/contests/years/2025`,
      `/contests/years/2025/leaderboards/global`, `/contests/x`, `/settings`.
      Open each signed out. Expect: `/sign-in` for each. _AV38 CV1_
- [ ] **16.2** Nobody, `/settings`. Open it signed out. Expect:
      `/sign-in?to=%2Fsettings`. _AR1_
- [ ] **16.3** Cora, that page. Enter a wrong password, then the right one.
      Expect: `/settings`. _AR2 AX1_
- [ ] **16.4** Grace, `/admin/contests`. Open it signed out, sign in, and enter
      a code. Expect: `/admin/contests`. _AR3_
- [ ] **16.5** Grace, `/admin/reports`. Open it signed out, sign in, and use a
      recovery code. Expect: `/admin/reports`. _AR3_
- [ ] **16.6** Grace, `/settings`. Open it signed out and sign in with a
      passkey. Manual. Expect: `/settings`. _AR4_
- [ ] **16.7** Ada, `/contests/years/2025/leaderboards/global?page=2`. Open it
      signed out and sign in. Expect: The same address, with the page number.
      _AR5_
- [ ] **16.8** Ada, `/sign-in?to=%2Fcontests%2Fpast`. Open it signed in. Expect:
      `/contests/past`. _AR6_
- [ ] **16.9** Ada, `/sign-in?to=https://other.example`, then
      `/sign-in?to=//other.example`. Sign in from each. Expect: `/contests`.
      _AR7_
- [ ] **16.10** Ada, `/sign-in?to=/my-bracket/x`, `/sign-in?to=/contests/new`,
      `/sign-in?to=/no-such-page`. Sign in from each. Expect: `/contests`. _AR8_
- [ ] **16.11** Grace, a new setup link, with no second factor. Open it signed
      out, and sign in. Expect: `/admin/setup`, without the link's secret in the
      address. _AR9_
- [ ] **16.12** Grace, the same link. Open it again. Expect: The choices, since
      the link wasn't used. _AR9_
- [ ] **16.13** Nobody, `/settings/name`, `/settings/password`,
      `/settings/delete-account`, `/settings/sign-out-others`,
      `/settings/remove-passkey`, `/settings/authenticator-app`. Open each
      signed in. Expect: `/settings`. _AV37_
- [ ] **16.14** Nobody, `/resend-confirmation` and `/sign-out`. Open each.
      Expect: `/sign-in` and `/`. _AV37_
- [ ] **16.15** Nobody, `/admin`, `/admin/bracket`, `/admin/results`,
      `/admin/reports`, `/admin/educators`, `/admin/contests`,
      `/admin/organizations`, `/admin/setup`, `/admin/verify`. Open each signed
      out, then as Cora. Expect: `/sign-in`, then "Page not found". _AV38 AV39_
- [ ] **16.16** Otto, any educator's contest, its `/trash`, `/leaderboard`, and
      `/leaderboard/:playerId`, as Gia. Open each. Expect: "Page not found".
      _CV3.5 CV4 CV5 CV6_
- [ ] **16.17** Nobody, `/contests/x`, `/contests/x/trash`, `/admin/contests/x`,
      `/my-bracket/x`, `/play/x`, `/confirm-address/x`. Open each signed in as
      Grace. Expect: "Page not found" for the first 3, "This link doesn’t work"
      for the others. _CV3.5 AV57 AV26_
- [ ] **16.18** Nobody, Period 1 Next, signed in as Gia. In Chrome's console run
      `(await fetch('/contests/CONTEST_ID/players/PLAYER_ID/personal-link', { method: 'POST' })).status`
      with Ada's IDs. Expect: 404. _CV7 P7_

### Phone width, keyboard, print, reload, and back

Set DevTools' device toolbar to 390 by 844 for the first step.

- [ ] **16.19** Every persona, `/`, `/sign-in`, `/sign-up`, `/contests`, a
      contest with a selection, its trash and leaderboard, `/settings`, L,
      P`/bracket` open and locked, `/admin`, `/admin/bracket`, `/admin/results`,
      `/admin/contests`. Open each at 390px. Expect: No sideways scroll of the
      page, rounds show as tabs, and every button can be pressed. _CV18 CV3 DV7_
- [ ] **16.20** Ada, contest. Use only Tab, Enter, Space, arrows, and Escape to
      approve, rename, open **•••**, and cancel a delete. Expect: Focus is
      always visible, moves into each dialog, and returns, also to **•••** after
      **Rename**. Cancel has focus first in a confirmation. _CV3.1 CV3.6 RG3_
- [ ] **16.21** Pat, P`/bracket`. Use only the keyboard to pick in a battle and
      from an empty side's menu. Expect: The pick is saved, every focused side
      has a visible outline, and after the menu the new side has focus. _P9 RG6
      RG8_
- [ ] **16.22** Grace, `/admin/results`. Use only the keyboard to record and
      clear a result. Expect: The result is saved and cleared, every focused
      side has a visible outline, and after an empty side's menu the new side
      has focus, also after a dialog. _DR1 DR3 RG6 RG8_
- [ ] **16.23** Ada, `/bracket`, `/contests/years/2025`, a marked bracket, a
      locked draft. Open print preview. Expect: Landscape, one diagram, and no
      header, footer, controls, or links back. _CV23_
- [ ] **16.24** Pat, P`/bracket` while open, and `/`. Open print preview.
      Expect: Landscape too, with the whole diagram on the page. _CV23_
- [ ] **16.25** Ada, a leaderboard and a contest. Open print preview. Expect:
      The table prints without buttons. _CV23_
- [ ] **16.26** Pat, P`/bracket`. Reload in the middle of picks. Expect: Every
      saved pick is there. _P9_
- [ ] **16.27** Grace, `/admin/educators`. Reload after finding an educator.
      Expect: Chrome asks to resubmit the form. _DV20_
- [ ] **16.28** Ada, any page after signing out. Press Back. Expect: `/sign-in`,
      and never Ada's page. _AX13_
- [ ] **16.29** Pat, P`/forgotten`. Press Back after forgetting. Expect:
      P`/forgotten`, and never Pat's picks. _P4_
- [ ] **16.30** Ada, `/sign-in`. Turn JavaScript off in DevTools, and sign in.
      Expect: `/contests`. _AJ1 AX1_
- [ ] **16.31** Pat, L. With JavaScript off, start a bracket. Expect:
      P`/bracket`. _AJ2 P1_
- [ ] **16.32** Nobody, L. Run `location.href = 'https://example.com'` in the
      console with Network open. Expect: No `Referer`. _AJ3_
- [ ] **16.33** Nobody, every page. Read Chrome's console during the run.
      Expect: No errors except the ones a step causes. _AV55_
- [ ] **16.34** Grace, `/admin/educators`. As the last step of the run, find
      Grace's own address, press **Delete account**, and type the address.
      Expect: `/account-deleted`: "Your account is deleted". _AT12 AE10_

## Forcing states

The steps name these commands. Run them in the terminal of [Setup](#setup).

### Submissions for the results sections

```sh
qa_fill 'Pat Q.' APPROVED
qa_fill 'Ava L.' APPROVED
qa_fill 'Ben T.' APPROVED
qa_fill 'Jonah K.' APPROVED -1
qa_fill 'Priya S.' APPROVED
qa_fill 'Rory S.' REJECTED
qa_fill 'Uma V.' PENDING
qa_fill 'Sky T.' APPROVED
qa_fill 'Wes X.' PENDING
qa_fill 'Olga O.' PENDING
qa_fill 'Omar O.' APPROVED
qa_fill 'Gil G.' APPROVED
```

### Accounts and sessions

```sh
# Unconfirmed educator
qa_sql "UPDATE \"Educator\" SET \"emailVerified\" = false WHERE email = 'una@late.example'"
qa_sql "INSERT INTO \"Contest\" (id, year, \"educatorId\", name, \"linkSecret\", \"updatedAt\")
  SELECT 'qa-una', 2025, id, 'Una Zoology', 'qa-una-link', now() FROM \"Educator\" WHERE email = 'una@late.example'"
# Imported educator
qa_sql "INSERT INTO \"Educator\" (id, name, email, \"updatedAt\") VALUES ('qa-imported', 'Imported Educator', 'imported@imported.example', now())"
# Launch email sent
qa_sql "UPDATE \"Educator\" SET \"launchEmailedAt\" = now() WHERE id = 'qa-imported'"
# Make the second factor stale, 13 hours after its use
qa_sql "UPDATE \"Session\" SET \"secondFactorUsedAt\" = now() - interval '13 hours'"
# Unlock the authenticator app
qa_sql "UPDATE \"AuthenticatorApp\" SET \"lockedUntil\" = NULL, \"failedVerificationCount\" = 0"
# Turn off the app, leaving its row
qa_sql "UPDATE \"Educator\" SET \"twoFactorEnabled\" = false"
# Remove second factors
qa_sql "DELETE FROM \"AuthenticatorApp\""
qa_sql "DELETE FROM \"Passkey\""
qa_sql "UPDATE \"Educator\" SET \"twoFactorEnabled\" = false"
# Expire links, which also ends sign-in challenges
qa_sql "UPDATE \"Verification\" SET \"expiresAt\" = now() - interval '1 minute'"
# Expire sessions, as 30 days without a visit do
qa_sql "UPDATE \"Session\" SET \"expiresAt\" = now() - interval '1 minute'"
```

A confirmation link isn't stored, so "Expire links" can't end one. Run the
server with `qa_clock` 4 days ahead to end it.

### Years

```sh
# Hide every year, which moves 2025 and its contests to the schema qa_hold
qa_sql "DO \$\$
DECLARE
  t text;
  f text;
BEGIN
  SET LOCAL session_replication_role = replica;
  CREATE SCHEMA qa_hold;
  FOREACH t IN ARRAY ARRAY['WildCardEntrant', 'SeedSlot', 'Result', 'Pick', 'Submission', 'Report', 'Share', 'Player', 'Contest', 'WildCard', 'Battle', 'Division', 'Combatant', 'Bracket'] LOOP
    f := CASE
      WHEN t = 'WildCardEntrant' THEN '\"wildCardId\" IN (SELECT id FROM \"WildCard\" WHERE year = 2025)'
      WHEN t = 'SeedSlot' THEN '\"divisionId\" IN (SELECT id FROM \"Division\" WHERE year = 2025)'
      WHEN t IN ('WildCard', 'Battle', 'Division', 'Combatant', 'Bracket') THEN 'year = 2025'
      ELSE 'true'
    END;
    EXECUTE format('CREATE TABLE qa_hold.%I AS SELECT * FROM public.%I WHERE %s', t, t, f);
    EXECUTE format('DELETE FROM public.%I WHERE %s', t, f);
  END LOOP;
END \$\$"
# Show 2025 again
qa_sql "DO \$\$
DECLARE
  t text;
BEGIN
  SET LOCAL session_replication_role = replica;
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'qa_hold' LOOP
    EXECUTE format('INSERT INTO public.%I SELECT * FROM qa_hold.%I', t, t);
  END LOOP;
  DROP SCHEMA qa_hold CASCADE;
END \$\$"
# No points
qa_sql 'UPDATE "Submission" SET score = 0'
# Earlier time
qa_sql "UPDATE \"Submission\" SET \"picksChangedAt\" = '2025-12-31' WHERE \"playerId\" IN (SELECT id FROM \"Player\" WHERE \"displayName\" = 'Ben T.')"
# Hide 2027, so 2025 is current
qa_sql 'UPDATE "Bracket" SET "publishedAt" = NULL WHERE year = 2027'
# Show 2027 again
qa_sql 'UPDATE "Bracket" SET "publishedAt" = now() WHERE year = 2027'
# Move Period 1 Next to 2025, while it has no players
qa_sql "UPDATE \"Contest\" SET year = 2025 WHERE name = 'Period 1 Next'"
# Move Period 1 Next back
qa_sql "UPDATE \"Contest\" SET year = 2027 WHERE name = 'Period 1 Next'"
```

"Stranded bracket" makes 2025 current and complete, with an unpublished 2027, on
April 2, 2027. It needs 2025's champion. Start it in place of the server, sign
in again, then bring 2027 back. Sign in with a recovery code, because a security
code would need the same clock. Starting a server ahead of time runs its daily
job, which deletes real sessions and links.

```sh
lsof -ti tcp:3055 -sTCP:LISTEN | xargs kill
qa_sql 'UPDATE "Bracket" SET "publishedAt" = NULL WHERE year = 2027'
(qa_clock 2027-04-02T19:00:00Z pnpm dev > "${TMPDIR:-/tmp}/mmmm-qa.log" 2>&1 &)
# After the step
lsof -ti tcp:3055 -sTCP:LISTEN | xargs kill
qa_sql 'UPDATE "Bracket" SET "publishedAt" = now() WHERE year = 2027'
(pnpm dev > "${TMPDIR:-/tmp}/mmmm-qa.log" 2>&1 &)
```

### Daily job

```sh
# Delete 8 days ago
qa_sql "UPDATE \"Player\" SET \"deletedAt\" = now() - interval '8 days' WHERE \"deletedBy\" = 'PLAYER'"
pnpm job:daily
# Two years later, unlocked
qa_sql 'UPDATE "Bracket" SET "lockedAt" = NULL WHERE year = 2025'
qa_clock 2027-05-02T19:00:00Z pnpm job:daily
qa_sql 'UPDATE "Bracket" SET "lockedAt" = now() WHERE year = 2025'
# Two years later
qa_clock 2027-05-02T19:00:00Z pnpm job:daily
# Server on May 2, 2027, in place of the server. Stop it and start the server again after the step
lsof -ti tcp:3055 -sTCP:LISTEN | xargs kill
(qa_clock 2027-05-02T19:00:00Z pnpm dev > "${TMPDIR:-/tmp}/mmmm-qa.log" 2>&1 &)
# Break one step of the daily job
qa_sql 'ALTER TABLE "Verification" RENAME TO "VerificationQa"'
pnpm job:daily
qa_sql 'ALTER TABLE "VerificationQa" RENAME TO "Verification"'
# Two in the morning, Arizona time, on a second port
(PORT=3056 BETTER_AUTH_URL=http://localhost:3056 qa_clock 2027-03-01T08:59:30Z pnpm dev > "${TMPDIR:-/tmp}/mmmm-qa-clock.log" 2>&1 &)
sleep 60; grep -c 'Daily job' "${TMPDIR:-/tmp}/mmmm-qa-clock.log"
lsof -ti tcp:3056 -sTCP:LISTEN | xargs kill
```

### Scale

Each of these adds rows that the last block removes.

```sh
# 120 approved players
qa_sql "WITH p AS (INSERT INTO \"Player\" (id, \"contestId\", \"displayName\", \"personalLinkHash\", \"linkVersion\")
  SELECT 'qa-bulk-' || n, c.id, 'Bulk ' || n, 'qa-bulk-' || n, 1 FROM generate_series(1, 120) n, \"Contest\" c WHERE c.name = 'Period 5 Biology' RETURNING id)
  INSERT INTO \"Submission\" (\"playerId\", status, \"picksChangedAt\") SELECT id, 'APPROVED', now() FROM p"
# 101 contests
qa_sql "INSERT INTO \"Contest\" (id, year, \"educatorId\", name, \"linkSecret\", \"updatedAt\")
  SELECT 'qa-bulk-' || n, 2025, e.id, 'Bulk contest ' || n, 'qa-bulk-' || n, now() FROM generate_series(1, 101) n, \"Educator\" e WHERE e.email = 'educator@example.com'"
# 101 reports, after 101 contests
qa_sql "INSERT INTO \"Report\" (id, \"contestId\", reason) SELECT 'qa-bulk-' || n, 'qa-bulk-1', 'OTHER' FROM generate_series(1, 101) n"
# Remove them
qa_sql "DELETE FROM \"Report\" WHERE id LIKE 'qa-bulk-%'"
qa_sql "DELETE FROM \"Contest\" WHERE id LIKE 'qa-bulk-%'"
qa_sql "DELETE FROM \"Player\" WHERE id LIKE 'qa-bulk-%' OR \"displayName\" LIKE 'Loop %'"
```

### Rate limits and requests

Set `SECRET` to the end of an open contest's link. Restart the server after
each, and wait a minute after "10,000 requests".

```sh
SECRET=paste-the-end-of-a-contest-link
# 301 players
for n in $(seq 1 300); do curl -s -o /dev/null -d "displayName=Loop $n" "localhost:3055/play/$SECRET?index"; done
curl -s -d 'displayName=Loop 301' "localhost:3055/play/$SECRET?index" | grep -o 'Too many new[^<"]*' | head -1
# 101 reports from one address
for n in $(seq 1 101); do curl -s -d 'target=contest&reason=OTHER' "localhost:3055/play/$SECRET/report"; done | tail -c 100
# 10,000 requests
node --input-type=module -e "
  const url = 'http://localhost:3055/resend-confirmation'
  const counts = {}
  let text
  await Promise.all(Array.from({ length: 100 }, async () => {
    for (let i = 0; i < 110; i++) {
      const response = await fetch(url, { redirect: 'manual' })
      counts[response.status] = (counts[response.status] ?? 0) + 1
      if (response.status === 429) text = await response.text()
      else await response.body?.cancel()
    }
  }))
  console.log(counts, text)"
# Cross-origin request
curl -s -w '%{http_code}\n' -H 'Origin: https://other.example' -d 'displayName=x' "localhost:3055/play/$SECRET?index"
# Auth endpoints
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3055/api/auth/sign-in/email
curl -s -o /dev/null -w '%{http_code}\n' localhost:3055/api/auth/passkey/generate-authenticate-options
# Database outage, for mmmm_qa only
qa_sql 'ALTER DATABASE mmmm_qa ALLOW_CONNECTIONS false' postgres
qa_sql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'mmmm_qa'" postgres
# After the steps
qa_sql 'ALTER DATABASE mmmm_qa ALLOW_CONNECTIONS true' postgres
# Staging, on this computer
(PORT=3056 BETTER_AUTH_URL=http://localhost:3056 APP_ENV=staging EMAIL_TRANSPORT=resend RESEND_API_KEY=unused STAGING_PASSWORD=qa pnpm dev > "${TMPDIR:-/tmp}/mmmm-qa-staging.log" 2>&1 &)
until curl -s -o /dev/null localhost:3056/healthz; do sleep 1; done
# Wrong staging passwords
for n in $(seq 1 31); do curl -s -o /dev/null -w '%{http_code} ' localhost:3056/; done
# After the steps
lsof -ti tcp:3056 -sTCP:LISTEN | xargs kill
```

The "Staging" server only copies staging's password check. It uses `mmmm_qa`.
Don't sign up there, because it would try to send email.

## Coverage

491 items: 482 covered by 689 steps, and 9 that can’t be covered by hand. Codes
starting with A are accounts. C, P, and R are contests, players, and reports. D
is the admin area. A step lists the codes it covers.

### Not covered by hand

| Item | What                                       | Why                                                                                     |
| ---- | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| DX2a | contest page, no year                      | A year with contests can’t be unpublished, so no contest exists without a current year  |
| DX4a | contest link, no year                      | As DX2a, no contest link exists without a current year                                  |
| DX5a | player bracket, no year                    | As DX2a, no player exists without a current year                                        |
| DX6d | create contest POST, archived              | No page offers a contest in a past year, since creating one uses the current year       |
| AM12 | Email launch                               | `pnpm launch:emails` refuses the mailbox and a server without HTTPS, so it needs Resend |
| DI1  | Import and launch: import                  | The import needs a copy of mmmm-old’s database                                          |
| DI2  | Import and launch: import rerun refused    | As DI1. The import’s tests cover the refusal                                            |
| DI6  | Import and launch: launch rejected address | Needs an address that Resend rejects. Its tests cover it                                |
| DI8  | Import and launch: launch run stops        | Needs failing sends through Resend. Its tests cover it                                  |

Also left to automated tests: two requests at the same instant, real email
delivery, Fly.io, backups, devices’ own passkey screens, and screen readers’
announcements beyond focus. Two refusals to publish need two requests at the
same instant: "The 2027 bracket is already published or deleted" and "The 2027
bracket is archived. Reload the page". So does "Record the current year’s
champion before publishing the 2027 bracket".

### Covered

| Item   | What                                                                           | Steps                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AE1    | None                                                                           | 1.9                                                                                                                                                                                    |
| AE2    | Unconfirmed, replaceable                                                       | 1.9, 1.12, 1.13, 1.35                                                                                                                                                                  |
| AE3    | Unconfirmed, kept                                                              | 2.24, 2.25, 7.40                                                                                                                                                                       |
| AE4    | Confirmed                                                                      | 1.15, 2.23, 14.50                                                                                                                                                                      |
| AE5    | In an organization or not                                                      | 1.24                                                                                                                                                                                   |
| AE6    | Admin                                                                          | 3.2, 14.39                                                                                                                                                                             |
| AE7    | Former admin                                                                   | 14.36                                                                                                                                                                                  |
| AE8    | Address change pending                                                         | 7.44, 14.1                                                                                                                                                                             |
| AE9    | Reset pending                                                                  | 2.15, 14.1                                                                                                                                                                             |
| AE10   | Deleted                                                                        | 7.65, 7.71, 16.34                                                                                                                                                                      |
| AT1    | None / replaceable: Sign up                                                    | 1.9, 1.13                                                                                                                                                                              |
| AT2    | Confirmed / kept: Sign up                                                      | 1.18, 2.25                                                                                                                                                                             |
| AT3    | Unconfirmed: Open confirmation link                                            | 1.15                                                                                                                                                                                   |
| AT4    | Confirmed: Open the link again                                                 | 1.16                                                                                                                                                                                   |
| AT5    | Unconfirmed: Expired, altered, or older link                                   | 1.14, 1.17                                                                                                                                                                             |
| AT6    | Unconfirmed: Sign in with right password                                       | 1.12                                                                                                                                                                                   |
| AT7    | Unconfirmed: Resend email                                                      | 1.10, 14.26                                                                                                                                                                            |
| AT8    | Any: Use reset link                                                            | 2.18, 2.19, 2.23, 14.50                                                                                                                                                                |
| AT9    | Confirmed: Save name                                                           | 2.3, 2.4                                                                                                                                                                               |
| AT10   | Confirmed: Change password                                                     | 2.10, 3.55                                                                                                                                                                             |
| AT11   | Confirmed: Delete account                                                      | 3.59, 3.60, 7.71                                                                                                                                                                       |
| AT12   | Any: Delete account                                                            | 7.65, 15.37, 16.34                                                                                                                                                                     |
| AT13   | Confirmed: Change address, Send the link                                       | 7.44, 7.45                                                                                                                                                                             |
| AT14   | Change pending: Confirm email address                                          | 7.48, 7.49, 7.52                                                                                                                                                                       |
| AT15   | Admin: Address leaves ADMIN_LIST (deploy)                                      | 14.35, 14.36                                                                                                                                                                           |
| AT16   | Plain: Address added (deploy)                                                  | 3.5, 14.39                                                                                                                                                                             |
| AS1    | Signed out                                                                     | 1.1, 1.31                                                                                                                                                                              |
| AS2    | Challenge pending                                                              | 3.28, 14.2                                                                                                                                                                             |
| AS3    | PASSWORD                                                                       | 1.24, 2.1, 2.6, 3.48                                                                                                                                                                   |
| AS4    | SETUP_LINK                                                                     | 3.11                                                                                                                                                                                   |
| AS5    | SECOND_FACTOR, fresh                                                           | 3.21, 3.46                                                                                                                                                                             |
| AS6    | SECOND_FACTOR, stale                                                           | 3.57                                                                                                                                                                                   |
| AS7    | Expired                                                                        | 14.3, 14.4                                                                                                                                                                             |
| AX1    | Signed out: Sign in, no app                                                    | 1.24, 1.32, 2.1, 2.21, 3.47, 16.3, 16.30                                                                                                                                               |
| AX2    | Signed out: Sign in, app on                                                    | 3.28                                                                                                                                                                                   |
| AX3    | Challenge: right code or recovery code                                         | 3.35, 3.40, 3.61                                                                                                                                                                       |
| AX4    | Challenge: wrong code                                                          | 3.29, 3.34, 3.39                                                                                                                                                                       |
| AX5    | Challenge: 6th try after 5 wrong, or 10 min                                    | 3.30, 14.2                                                                                                                                                                             |
| AX6    | Challenge: 10 wrong in a row across challenges                                 | 3.31                                                                                                                                                                                   |
| AX7    | Signed out: Sign in with a passkey                                             | 3.46                                                                                                                                                                                   |
| AX8    | PASSWORD or stale: redeem setup link, admin without a second factor            | 3.11, 3.65                                                                                                                                                                             |
| AX9    | SETUP_LINK or SECOND_FACTOR: add a passkey, or turn on the app                 | 3.21, 3.65                                                                                                                                                                             |
| AX10   | PASSWORD or stale: Use your passkey at /admin/verify                           | 3.50                                                                                                                                                                                   |
| AX11   | SECOND_FACTOR: 12 hours                                                        | 3.57, 14.30                                                                                                                                                                            |
| AX12   | SETUP_LINK or SECOND_FACTOR: change password                                   | 3.55, 3.56                                                                                                                                                                             |
| AX13   | any: Sign out, Sign out other sessions, change or reset password,…             | 1.31, 2.8, 2.9, 2.10, 2.11, 2.18, 7.49, 15.13, 15.39, 16.28                                                                                                                            |
| AF1    | No second factor                                                               | 1.24, 3.4                                                                                                                                                                              |
| AF2    | Setup link sent                                                                | 3.8                                                                                                                                                                                    |
| AF3    | Passkey                                                                        | 3.42                                                                                                                                                                                   |
| AF4    | App started                                                                    | 3.15, 3.16                                                                                                                                                                             |
| AF5    | App on                                                                         | 3.21                                                                                                                                                                                   |
| AF6    | App locked                                                                     | 3.31, 3.32                                                                                                                                                                             |
| AF7    | Last one                                                                       | 3.41, 3.45, 14.34                                                                                                                                                                      |
| AF8    | Former admin's                                                                 | 14.35, 14.36, 14.37, 14.38                                                                                                                                                             |
| AL1    | Sign in, change password                                                       | 14.22, 14.24                                                                                                                                                                           |
| AL2    | Sign up, reset request, resend                                                 | 1.20, 14.25, 14.26                                                                                                                                                                     |
| AL3    | Email per address                                                              | 14.27, 14.28                                                                                                                                                                           |
| AL4    | Requests per IP                                                                | 14.21                                                                                                                                                                                  |
| AL5    | Staging password failures                                                      | 14.46                                                                                                                                                                                  |
| AL6    | Security codes                                                                 | 3.30, 3.31                                                                                                                                                                             |
| AL7    | Password prompts in settings and setup                                         | 14.24                                                                                                                                                                                  |
| AV1    | / signed out, upcoming bracket not published                                   | 1.1, 8.4                                                                                                                                                                               |
| AV2    | / signed out, no bracket at all                                                | 4.4                                                                                                                                                                                    |
| AV3    | / signed out, upcoming is current                                              | 4.34, 12.21                                                                                                                                                                            |
| AV4    | / signed in                                                                    | 1.25                                                                                                                                                                                   |
| AV5    | / player remembered by this browser                                            | 6.39                                                                                                                                                                                   |
| AV6    | /sign-up form                                                                  | 1.6, 1.7, 1.8                                                                                                                                                                          |
| AV7    | /sign-up sent                                                                  | 1.9                                                                                                                                                                                    |
| AV8    | /sign-up rate limited                                                          | 1.20                                                                                                                                                                                   |
| AV9    | /sign-in form                                                                  | 1.21, 1.22                                                                                                                                                                             |
| AV10   | /sign-in wrong credentials                                                     | 1.22                                                                                                                                                                                   |
| AV11   | /sign-in notices                                                               | 1.14, 1.15, 2.18, 3.30, 3.62                                                                                                                                                           |
| AV12   | /sign-in unconfirmed                                                           | 1.12                                                                                                                                                                                   |
| AV13   | /sign-in passkey canceled                                                      | 1.23                                                                                                                                                                                   |
| AV14   | /sign-in/code form                                                             | 3.28                                                                                                                                                                                   |
| AV15   | /sign-in/code no challenge                                                     | 3.62                                                                                                                                                                                   |
| AV16   | /sign-in/code, app removed meanwhile                                           | 3.63, 3.64                                                                                                                                                                             |
| AV17   | /sign-in/recovery-code form                                                    | 3.33                                                                                                                                                                                   |
| AV18   | the 4 above signed in                                                          | 1.26                                                                                                                                                                                   |
| AV19   | /forgot-password form                                                          | 1.21, 2.13                                                                                                                                                                             |
| AV20   | /forgot-password?link-invalid notice                                           | 2.19, 2.22, 14.1                                                                                                                                                                       |
| AV21   | /forgot-password sent                                                          | 1.30, 2.14, 2.15                                                                                                                                                                       |
| AV22   | /forgot-password signed in                                                     | 1.29, 2.22                                                                                                                                                                             |
| AV23   | /reset-password?token= form                                                    | 2.16, 2.17                                                                                                                                                                             |
| AV24   | /reset-password no token, or ?error                                            | 2.20                                                                                                                                                                                   |
| AV25   | /confirm-address/:secret valid                                                 | 7.47                                                                                                                                                                                   |
| AV26   | /confirm-address/:secret used, expired, unknown, or address taken…             | 7.46, 7.51, 14.1, 14.29, 16.17                                                                                                                                                         |
| AV27   | /account-deleted after deletion, or by URL in any state                        | 7.71, 7.72                                                                                                                                                                             |
| AV28   | /settings plain educator                                                       | 1.28, 2.2                                                                                                                                                                              |
| AV29   | /settings organization                                                         | 1.28, 1.34, 5.4                                                                                                                                                                        |
| AV30   | /settings admin or former admin                                                | 3.4, 14.36                                                                                                                                                                             |
| AV31   | /settings second factor admin, PASSWORD or stale                               | 3.4, 3.58                                                                                                                                                                              |
| AV32   | /settings second factor former admin, PASSWORD                                 | 14.37                                                                                                                                                                                  |
| AV33   | /settings second factor can change                                             | 3.36, 3.42, 14.36                                                                                                                                                                      |
| AV34   | /settings wrong password (password or app form)                                | 2.5, 3.14, 3.37, 14.24                                                                                                                                                                 |
| AV35   | /settings sign out others                                                      | 2.7, 2.8                                                                                                                                                                               |
| AV36   | /settings delete dialog                                                        | 3.59, 3.60, 7.67, 7.68, 7.69, 7.70                                                                                                                                                     |
| AV37   | /settings/ (6 action routes), /resend-confirmation, /sign-out…                 | 16.13, 16.14                                                                                                                                                                           |
| AV38   | /admin signed out                                                              | 3.1, 16.1, 16.15                                                                                                                                                                       |
| AV39   | /admin not an admin                                                            | 1.27, 16.15                                                                                                                                                                            |
| AV40   | /admin/setup request                                                           | 3.5                                                                                                                                                                                    |
| AV41   | /admin/setup sent                                                              | 3.8, 14.28                                                                                                                                                                             |
| AV42   | /admin/setup?token= invalid                                                    | 3.10, 14.1                                                                                                                                                                             |
| AV43   | /admin/setup choose                                                            | 3.11, 3.12                                                                                                                                                                             |
| AV44   | /admin/setup has a second factor                                               | 3.26                                                                                                                                                                                   |
| AV45   | /admin/setup/authenticator-app password, scan, codes                           | 3.13, 3.14, 3.15, 3.19, 3.20, 3.21, 3.22, 3.23                                                                                                                                         |
| AV46   | /admin/setup/authenticator-app already on, or may not change                   | 3.7, 3.26                                                                                                                                                                              |
| AV47   | /admin/verify has a passkey                                                    | 3.48, 3.49, 3.52, 14.30                                                                                                                                                                |
| AV48   | /admin/verify app only                                                         | 3.57, 3.61, 14.30                                                                                                                                                                      |
| AV49   | /admin/verify fresh, or none                                                   | 3.5, 3.6, 3.26                                                                                                                                                                         |
| AV50   | /admin/educators empty, error, found confirmed, found unconfirmed              | 7.37, 7.38, 7.39, 7.40, 7.42                                                                                                                                                           |
| AV51   | /admin/educators change dialog errors                                          | 7.43, 14.27, 15.36                                                                                                                                                                     |
| AV52   | /privacy, /terms, /retention one view each                                     | 1.3                                                                                                                                                                                    |
| AV53   | /dev/mailbox empty, emails, 404 with Resend                                    | 1.5, 1.11, 14.47, 14.48                                                                                                                                                                |
| AV54   | any unknown path 404                                                           | 1.4                                                                                                                                                                                    |
| AV55   | any thrown error 500 etc.                                                      | 14.40, 16.33                                                                                                                                                                           |
| AV56   | root loader failed                                                             | 14.41                                                                                                                                                                                  |
| AV57   | broken contest link or personal link 404                                       | 5.19, 6.48, 6.55, 6.62, 12.5, 16.17                                                                                                                                                    |
| AV58   | cross-origin POST 403                                                          | 14.43                                                                                                                                                                                  |
| AV59   | staging, no password 401                                                       | 14.45                                                                                                                                                                                  |
| AV60   | /healthz up 200, down 503                                                      | 14.40, 14.42                                                                                                                                                                           |
| AV61   | /api/auth/ 6 public endpoints, others blank 404                                | 14.44                                                                                                                                                                                  |
| AM1    | Email confirm-email                                                            | 1.11, 14.48                                                                                                                                                                            |
| AM2    | Email already-signed-up                                                        | 1.19                                                                                                                                                                                   |
| AM3    | Email reset-password                                                           | 2.15                                                                                                                                                                                   |
| AM4    | Email password-changed                                                         | 2.12                                                                                                                                                                                   |
| AM5    | Email second-factor-setup                                                      | 3.9                                                                                                                                                                                    |
| AM6    | Email second-factor-changed: passkey added                                     | 3.42                                                                                                                                                                                   |
| AM7    | Email second-factor-changed: passkey removed                                   | 3.53                                                                                                                                                                                   |
| AM8    | Email second-factor-changed: app added                                         | 3.27                                                                                                                                                                                   |
| AM9    | Email second-factor-changed: app removed                                       | 3.44                                                                                                                                                                                   |
| AM10   | Email confirm-address                                                          | 7.47                                                                                                                                                                                   |
| AM11   | Email address-changed                                                          | 7.50                                                                                                                                                                                   |
| AG1    | Second factor transition: Passkey: add                                         | 3.42, 3.43                                                                                                                                                                             |
| AG2    | Second factor transition: Passkey: remove                                      | 3.53, 3.54                                                                                                                                                                             |
| AG3    | Second factor transition: App: start                                           | 3.13, 3.15                                                                                                                                                                             |
| AG4    | Second factor transition: App: start again, new secret                         | 3.16, 3.17                                                                                                                                                                             |
| AG5    | Second factor transition: App: turn on                                         | 3.21, 3.51                                                                                                                                                                             |
| AG6    | Second factor transition: App: turn off                                        | 3.44, 14.38                                                                                                                                                                            |
| AG7    | Second factor transition: App: new recovery codes                              | 3.38                                                                                                                                                                                   |
| AG8    | Second factor transition: Setup link replaced by the next                      | 3.9, 3.10                                                                                                                                                                              |
| CY1    | Year: No current year                                                          | 4.1                                                                                                                                                                                    |
| CY2    | Year: Open                                                                     | 4.39, 5.1, 12.4, 14.33                                                                                                                                                                 |
| CY3    | Year: Locked (in progress or complete)                                         | 9.11, 9.75                                                                                                                                                                             |
| CY4    | Year: Locked, all results cleared                                              | 10.1, 10.2                                                                                                                                                                             |
| CY5    | Year: Reopened                                                                 | 10.5, 10.8, 10.9                                                                                                                                                                       |
| CY6    | Year: Past (archived)                                                          | 12.2, 13.4                                                                                                                                                                             |
| CS1    | Contest: Active, owned                                                         | 5.1                                                                                                                                                                                    |
| CS2    | Contest: In the trash, owned                                                   | 5.46, 5.49                                                                                                                                                                             |
| CS3    | Contest: Orphaned                                                              | 7.66, 7.73                                                                                                                                                                             |
| CS4    | Contest: Orphaned and in the trash                                             | 7.80                                                                                                                                                                                   |
| CS5    | Contest: Hidden                                                                | 7.17, 7.18, 7.66, 9.42                                                                                                                                                                 |
| CS6    | Contest: Shared                                                                | 5.55                                                                                                                                                                                   |
| CS7    | Contest: Erased                                                                | 5.50, 7.31                                                                                                                                                                             |
| CS8    | Contest: Link version n                                                        | 5.18                                                                                                                                                                                   |
| C1     | none: Create contest → name → Create contest                                   | 4.2, 5.6, 5.7, 5.8, 5.9, 5.71, 5.72, 9.6, 12.17                                                                                                                                        |
| C2     | active: Rename → Save (Escape or Cancel cancels)                               | 5.13, 5.14, 12.6, 15.1                                                                                                                                                                 |
| C3     | active: Replace contest link                                                   | 5.17, 5.18, 5.19, 15.2, 15.32                                                                                                                                                          |
| C4     | active: Delete contest → "Delete {name}?" → Delete contest                     | 5.48, 5.49, 5.71, 10.11, 12.8, 15.4                                                                                                                                                    |
| C5     | trash: Restore                                                                 | 5.47, 15.5                                                                                                                                                                             |
| C6     | trash: Delete forever → "Delete {name} and its brackets…                       | 5.50, 15.6                                                                                                                                                                             |
| C7     | trash: Empty trash                                                             | 5.51                                                                                                                                                                                   |
| C8     | trash: next year published                                                     | 12.4                                                                                                                                                                                   |
| C9     | active: Share contest with colleague's email                                   | 5.52, 5.53, 5.54, 5.55, 5.62, 12.7, 15.3                                                                                                                                               |
| C10    | shared: Stop sharing → "Stop sharing with {name}?" → Stop…                     | 5.60, 5.61, 13.9, 15.7                                                                                                                                                                 |
| C11    | shared: either educator leaves the organization or is deleted                  | 14.53                                                                                                                                                                                  |
| C12    | active: owner deletes account                                                  | 7.66, 7.71                                                                                                                                                                             |
| C13    | orphaned, outside trash: hand-over                                             | 7.84, 7.88, 7.90, 13.17                                                                                                                                                                |
| C14    | active, outside trash: hide, show                                              | 7.17                                                                                                                                                                                   |
| PS1    | Player: Draft                                                                  | 5.20, 6.5, 6.38                                                                                                                                                                        |
| PS2    | Player: Pending, Approved, Rejected                                            | 5.20, 5.22, 6.14, 8.26                                                                                                                                                                 |
| PS3    | Player: With unsubmitted changes                                               | 6.17, 6.23, 6.44, 8.27, 9.23, 15.21                                                                                                                                                    |
| PS4    | Player: Picks cleared by a move                                                | 8.21                                                                                                                                                                                   |
| PS5    | Player: Trash, deleted by educator                                             | 5.39, 5.41                                                                                                                                                                             |
| PS6    | Player: Trash, deleted by player                                               | 5.41, 6.47, 12.1                                                                                                                                                                       |
| PS7    | Player: Erased                                                                 | 5.44, 7.23, 13.12, 13.18, 14.5                                                                                                                                                         |
| PS8    | Player: Name removed                                                           | 14.7, 14.8                                                                                                                                                                             |
| PS9    | Player: Remembered by browser                                                  | 6.5                                                                                                                                                                                    |
| PS10   | Player: Old or current contest link                                            | 6.53                                                                                                                                                                                   |
| P1     | none: Start my bracket                                                         | 6.2, 6.3, 6.4, 6.5, 6.38, 7.74, 9.7, 14.19, 15.14, 15.32, 16.31                                                                                                                        |
| P2     | remembered: Continue as {name}                                                 | 6.26, 6.27                                                                                                                                                                             |
| P3     | remembered: Not you? Start a new bracket (or Not you? when closed or orphaned) | 6.36, 6.40, 7.73, 9.18, 15.15                                                                                                                                                          |
| P4     | remembered: Done, forget my bracket here → Forget my bracket                   | 6.28, 9.26, 16.29                                                                                                                                                                      |
| P5     | remembered: 15 minutes idle                                                    | 6.32                                                                                                                                                                                   |
| P6     | any: open personal link /my-bracket/:secret                                    | 6.30, 6.50, 6.56                                                                                                                                                                       |
| P7     | any: Replace personal link                                                     | 5.34, 5.35, 5.37, 6.55, 6.61, 8.25, 15.19, 16.18                                                                                                                                       |
| P8     | any: menu → Rename → Save                                                      | 5.32, 5.33, 9.75, 15.9                                                                                                                                                                 |
| P9     | draft: pick or clear by a changed pick                                         | 6.6, 6.8, 6.9, 6.12, 15.18, 15.30, 16.21, 16.26                                                                                                                                        |
| P10    | draft, all 64 picked: Submit bracket                                           | 6.14, 6.40, 6.45, 6.58, 6.59, 6.60, 8.23, 8.26, 10.10                                                                                                                                  |
| P11    | draft, incomplete: Submit bracket                                              | 6.7                                                                                                                                                                                    |
| P12    | submitted: pick → Submit changes                                               | 6.20, 6.24, 6.43                                                                                                                                                                       |
| P13    | submitted with changes: Discard changes → "Discard your changes?" → Discard…   | 6.19                                                                                                                                                                                   |
| P14    | pending, rejected: Approve (row, selection Approve n, Approve all…             | 5.22, 5.23, 5.29, 5.31, 6.21, 6.58, 6.60, 9.54, 9.75, 15.8                                                                                                                             |
| P15    | pending, approved: Reject (row, or selection)                                  | 5.23, 5.30, 6.41, 9.75, 15.8                                                                                                                                                           |
| P16    | any outside trash: row menu Delete, or selection Delete n → "Delete…           | 5.38, 5.39, 5.40, 6.51, 6.53, 9.75, 15.10                                                                                                                                              |
| P17    | any outside trash: Delete my bracket → "Delete your bracket?" → Delete…        | 6.46, 6.47, 6.54, 7.77, 9.76, 12.1, 13.11, 15.25                                                                                                                                       |
| P18    | trash: Restore                                                                 | 5.42, 6.49, 8.25, 9.75, 13.11, 15.11                                                                                                                                                   |
| P19    | trash: Delete forever → "Delete {name}’s bracket forever?", or…                | 5.43, 5.44, 5.45, 13.12, 15.12                                                                                                                                                         |
| P20    | trash, by player: daily job, 7 days                                            | 14.5                                                                                                                                                                                   |
| P21    | trash, or draft: next year published                                           | 12.3, 12.5                                                                                                                                                                             |
| P22    | any: an admin’s Delete forever                                                 | 7.23, 13.18                                                                                                                                                                            |
| P23    | submitted, open: admin moves combatants in its battles                         | 8.21, 8.24                                                                                                                                                                             |
| P24    | submitted, locked: same                                                        | 9.73                                                                                                                                                                                   |
| P25    | P24: admin reopens                                                             | 10.8                                                                                                                                                                                   |
| P26    | any: two years pass                                                            | 14.7, 14.8                                                                                                                                                                             |
| P27    | any: combatant renamed                                                         | 8.13                                                                                                                                                                                   |
| R1     | Report → choose target and reason ("Rude or hurtful",…                         | 7.2, 7.4, 7.5, 14.20, 15.33                                                                                                                                                            |
| R2     | Same report again                                                              | 7.12                                                                                                                                                                                   |
| R3     | Dismiss at /contests/reports                                                   | 7.8, 7.11, 14.54                                                                                                                                                                       |
| R4     | Player or contest trashed, restored                                            | 7.13, 7.14                                                                                                                                                                             |
| RP1    | Pick reply: Couldn’t save (network, 5xx, 429), Try again                       | 6.10, 6.11                                                                                                                                                                             |
| RP2    | Pick reply: Submissions just closed (423), Reload                              | 9.8, 9.9, 9.10                                                                                                                                                                         |
| RP3    | Pick reply: Refused: reload the page to keep picking                           | 8.22, 15.16, 15.31                                                                                                                                                                     |
| RP4    | Pick reply: Submit variants                                                    | 6.13, 9.9                                                                                                                                                                              |
| RP5    | Pick reply: Discard variants                                                   | 6.18                                                                                                                                                                                   |
| RS1    | Report: unread by educator                                                     | 7.4, 7.6                                                                                                                                                                               |
| RS2    | Report: dismissed by educator                                                  | 7.8                                                                                                                                                                                    |
| RS3    | Report: unread by admin                                                        | 7.4, 7.9                                                                                                                                                                               |
| RS4    | Report: dismissed by admin                                                     | 7.11                                                                                                                                                                                   |
| RS5    | Report: suppressed while in the trash                                          | 7.13                                                                                                                                                                                   |
| RS6    | Report: deleted by erase or name removal                                       | 13.18, 14.7                                                                                                                                                                            |
| RD1    | Report a name on L, contest name only                                          | 6.1                                                                                                                                                                                    |
| RD2    | Report dialog on shared C                                                      | 5.57, 7.5                                                                                                                                                                              |
| RD3    | Report dialog on shared C/leaderboard                                          | 9.30                                                                                                                                                                                   |
| RD4    | Report dialog on years leaderboards                                            | 9.32, 14.9                                                                                                                                                                             |
| RD5    | Report dialog on player leaderboards                                           | 9.40                                                                                                                                                                                   |
| CO1    | Organization: none (free email)                                                | 1.33, 5.72, 9.12                                                                                                                                                                       |
| CO2    | Organization: unnamed                                                          | 1.24, 5.2, 5.5                                                                                                                                                                         |
| CO3    | Organization: named                                                            | 5.3                                                                                                                                                                                    |
| CO4    | Organization: second naming refused                                            | 5.3                                                                                                                                                                                    |
| CL1    | Leaderboard: no points                                                         | 9.44, 9.51                                                                                                                                                                             |
| CL2    | Leaderboard: shared rank                                                       | 9.47                                                                                                                                                                                   |
| CL3    | Leaderboard: rank tie broken by time                                           | 9.52                                                                                                                                                                                   |
| CL4    | Leaderboard: podium, no split of a shared rank                                 | 9.46, 9.49                                                                                                                                                                             |
| CL5    | Leaderboard: pages of 100                                                      | 14.16                                                                                                                                                                                  |
| CL6    | Leaderboard: names educator sees                                               | 9.31                                                                                                                                                                                   |
| CL7    | Leaderboard: names player sees                                                 | 9.38                                                                                                                                                                                   |
| CL8    | Leaderboard: hidden name labels                                                | 9.31, 9.34, 9.35                                                                                                                                                                       |
| CV1    | /contests                                                                      | 1.24, 16.1                                                                                                                                                                             |
| CV1.1  | No published bracket                                                           | 4.3                                                                                                                                                                                    |
| CV1.2  | Open, no contests                                                              | 1.24, 1.33, 3.2, 12.4                                                                                                                                                                  |
| CV1.3  | Open, some: list, each Copy link, Create contest in…                           | 2.1, 5.1, 10.9                                                                                                                                                                         |
| CV1.4  | Locked, with leaderboard links                                                 | 9.11, 9.12                                                                                                                                                                             |
| CV1.5  | Optional: "Name your organization", "Shared with you",…                        | 5.1, 5.56                                                                                                                                                                              |
| CV2    | /contests/new, /contests/organization: GET redirects to…                       | 5.69                                                                                                                                                                                   |
| CV3    | C                                                                              | 16.19                                                                                                                                                                                  |
| CV3.1  | Own, open: contest link, Copy link, "Show a QR code",…                         | 5.10, 5.11, 5.12, 5.20, 5.21, 16.20                                                                                                                                                    |
| CV3.2  | Own, locked                                                                    | 9.13, 9.14                                                                                                                                                                             |
| CV3.3  | Own, past                                                                      | 13.7, 13.8                                                                                                                                                                             |
| CV3.4  | Shared                                                                         | 5.57                                                                                                                                                                                   |
| CV3.5  | 404 "Page not found": other educator's, trashed, erased,…                      | 5.61, 5.63, 7.34, 16.16, 16.17                                                                                                                                                         |
| CV3.6  | Selection bar: "n selected", Clear, Approve n,…                                | 5.24, 5.25, 5.27, 5.28, 16.20                                                                                                                                                          |
| CV4    | C/trash: own only, empty, rows                                                 | 5.41, 5.45, 5.58, 9.16, 13.10, 16.16                                                                                                                                                   |
| CV5    | C/leaderboard: while open, empty, podium, table                                | 5.59, 9.15, 9.27, 9.30, 16.16                                                                                                                                                          |
| CV6    | C/leaderboard/:playerId: "{label}’s bracket", "{rank} ·…                       | 9.28, 9.29, 16.16                                                                                                                                                                      |
| CV7    | GET of C/report, C/name, C/link, C/delete,…                                    | 5.70, 16.18                                                                                                                                                                            |
| CV8    | /contests/trash: rows, empty, back link                                        | 5.46, 5.47                                                                                                                                                                             |
| CV9    | /contests/past: per year, "Champion: {name}" (if any),…                        | 5.64, 13.1, 13.2                                                                                                                                                                       |
| CV10   | /contests/years/:year: "{year} bracket", leaderboard…                          | 5.66, 5.67, 13.4, 13.5                                                                                                                                                                 |
| CV11   | /contests/years/:year/leaderboards/organizationorglobal:…                      | 5.68, 9.31, 9.35, 9.36, 9.37, 13.6, 14.16                                                                                                                                              |
| CV12   | …/leaderboards/:kind/:playerId: as 6.                                          | 9.33, 9.34, 13.6                                                                                                                                                                       |
| CV13   | /contests/reports: list, "No reports.", and the header’s count                 | 5.65, 7.6, 7.7, 9.77                                                                                                                                                                   |
| CV14   | L                                                                              | 6.1                                                                                                                                                                                    |
| CV14.1 | Name form "What’s your first name and last initial?".                          | 6.1                                                                                                                                                                                    |
| CV14.2 | Returning "Continue as {name}?".                                               | 6.26, 9.18                                                                                                                                                                             |
| CV14.3 | "Submissions are closed" (locked or past). "This contest…                      | 7.73, 9.17, 10.3, 13.16                                                                                                                                                                |
| CV14.4 | All with Report. Label "{contest} · {educator}’s…                              | 6.1, 7.73                                                                                                                                                                              |
| CV14.5 | Deleted contest’s link, and an unknown or replaced link                        | 5.19, 6.57, 6.62                                                                                                                                                                       |
| CV15   | L/deleted and /bracket-deleted                                                 | 6.47, 6.54, 7.78                                                                                                                                                                       |
| CV16   | /contest-removed: "Your educator deleted this contest"                         | 6.57, 7.79                                                                                                                                                                             |
| CV17   | /my-bracket/:secret: active, deleted, unknown                                  | 6.30, 6.48, 6.52, 6.53, 6.62, 7.78                                                                                                                                                     |
| CV18   | P/bracket                                                                      | 6.5, 16.19                                                                                                                                                                             |
| CV18.1 | Open: draft ("n of 64 picked", "Picks save as you go",…                        | 6.5, 6.15, 6.16, 6.17, 6.22, 6.23, 6.42, 7.75, 8.21                                                                                                                                    |
| CV18.2 | Locked: unsubmitted, pending, approved, rejected, with changes, past, orphaned | 9.19, 9.20, 9.22, 9.23, 9.24, 9.25, 11.4, 13.15                                                                                                                                        |
| CV18.3 | Past: banner, "Go to {current}" → /bracket.                                    | 13.13, 13.14, 13.15                                                                                                                                                                    |
| CV18.4 | Not remembered → P/forgotten.                                                  | 6.29                                                                                                                                                                                   |
| CV19   | P/forgotten: "This device forgot your bracket"                                 | 6.28, 6.31, 6.32, 9.26                                                                                                                                                                 |
| CV20   | P/leaderboards/contestororganizationorglobal,…                                 | 6.25, 9.21, 9.24, 9.38, 9.39, 9.41, 9.42                                                                                                                                               |
| CV21   | P alone goes to P/bracket, and the GETs of its action-only pages               | 6.33, 6.34, 6.35                                                                                                                                                                       |
| CV22   | /bracket: current bracket, and "Brackets are expected to lock on"              | 1.2, 4.5, 8.3                                                                                                                                                                          |
| CV23   | Print rules                                                                    | 16.23, 16.24, 16.25                                                                                                                                                                    |
| DY1    | Bracket: No bracket                                                            | 4.21                                                                                                                                                                                   |
| DY2    | Bracket: Setup                                                                 | 4.1, 4.8, 4.28, 12.12                                                                                                                                                                  |
| DY3    | Bracket: Open                                                                  | 4.29, 4.39, 9.1, 12.2                                                                                                                                                                  |
| DY4    | Bracket: In progress, with results                                             | 9.5                                                                                                                                                                                    |
| DY5    | Bracket: In progress, no results                                               | 10.1                                                                                                                                                                                   |
| DY6    | Bracket: Complete                                                              | 11.2                                                                                                                                                                                   |
| DY7    | Bracket: Archived                                                              | 12.2, 12.19                                                                                                                                                                            |
| DY8    | Bracket: unpublished after April 1                                             | 14.13                                                                                                                                                                                  |
| DT1    | No bracket: /admin > "Set up the {year} bracket" > fill > "Save…               | 4.28, 11.6                                                                                                                                                                             |
| DT2    | Setup: "Save changes"                                                          | 4.15, 4.22, 4.30                                                                                                                                                                       |
| DT3    | Setup: "Delete {year} bracket" > confirm                                       | 4.21, 4.23, 4.38                                                                                                                                                                       |
| DT4    | Setup: "Publish {year} bracket" > confirm                                      | 4.29, 11.9, 12.2, 12.13                                                                                                                                                                |
| DT5    | Open: "Unpublish" > "Unpublish {year} bracket"                                 | 4.35, 4.36, 12.12, 12.15, 12.18                                                                                                                                                        |
| DT6    | Setup, Open: "Save date"                                                       | 4.11, 8.2, 10.12, 12.14                                                                                                                                                                |
| DT7    | Open: first result > "Save result and lock"                                    | 9.3, 9.4, 9.5, 11.1                                                                                                                                                                    |
| DT8    | In progress: record, change ("Change result"), clear ("Clear result")          | 9.45, 9.55, 9.57, 9.59, 9.60, 9.61, 10.1, 12.19                                                                                                                                        |
| DT9    | In progress, 0 results: "Reopen submissions" > confirm                         | 10.4, 10.5, 10.6, 12.16                                                                                                                                                                |
| DT10   | In progress: record the Championship winner                                    | 11.2, 11.3, 11.11                                                                                                                                                                      |
| DT11   | Complete: clear or change so no Championship result                            | 11.5, 11.8                                                                                                                                                                             |
| DT12   | Complete: Publish newer year                                                   | 12.2                                                                                                                                                                                   |
| DR1    | Undecided, both sides known: press a side                                      | 9.2, 9.3, 11.11, 16.22                                                                                                                                                                 |
| DR2    | Undecided, sides unknown: press the empty side, pick from its menu             | 9.55, 11.1                                                                                                                                                                             |
| DR3    | Decided: press the winner                                                      | 9.56, 9.57, 16.22                                                                                                                                                                      |
| DR4    | Decided: press another contender                                               | 9.58                                                                                                                                                                                   |
| DR5    | Undecided, exactly 2 known sides: "Record a merge", Battle select,…            | 9.62, 9.63, 9.64, 9.70, 9.71                                                                                                                                                           |
| DR6    | Merged: press the winner, or a side that advanced                              | 9.66, 9.69                                                                                                                                                                             |
| DR7    | Merged: pressing either side asks to clear it                                  | 9.68                                                                                                                                                                                   |
| DR8    | A later merge of a merge: clear the inner one                                  | 9.66, 9.67                                                                                                                                                                             |
| DC1    | Rename (also merges, under "Merges")                                           | 8.5, 8.6, 8.7, 8.8, 9.65, 12.20, 15.38                                                                                                                                                 |
| DC2    | Move: choose Swap and With, "Add swap", "Review N swaps", "Move…               | 8.14, 8.15, 8.18, 8.19, 8.20, 9.72                                                                                                                                                     |
| DC3    | Move before lock                                                               | 8.19, 8.21                                                                                                                                                                             |
| DC4    | Move after lock                                                                | 9.72, 9.73                                                                                                                                                                             |
| DK1    | Admin contest: Shown                                                           | 7.16, 7.20                                                                                                                                                                             |
| DK2    | Admin contest: Hidden                                                          | 7.17, 7.66                                                                                                                                                                             |
| DK3    | Admin contest: Orphaned                                                        | 7.66                                                                                                                                                                                   |
| DK4    | Admin contest: In trash                                                        | 7.16                                                                                                                                                                                   |
| DK5    | Admin contest: Orphaned and in trash                                           | 7.80                                                                                                                                                                                   |
| DKA1   | Hide, Show                                                                     | 7.17, 7.20, 9.43, 13.17, 15.34                                                                                                                                                         |
| DKA2   | Hand over > address > "Find educator" > "Hand over to {name}"                  | 7.84, 7.86, 7.87, 7.88, 7.89, 13.17                                                                                                                                                    |
| DKA3   | Open contest, Delete forever on a player                                       | 7.23, 13.18, 15.35                                                                                                                                                                     |
| DE1    | Change address, Send link                                                      | 7.43, 7.44, 14.27, 15.36                                                                                                                                                               |
| DE2    | Link /confirm-address/:secret > "Confirm email address"                        | 7.48, 14.29                                                                                                                                                                            |
| DE3    | Delete account > type address                                                  | 7.64, 7.65                                                                                                                                                                             |
| DV1    | /admin, only the setup card, not set up yet                                    | 4.21                                                                                                                                                                                   |
| DV2    | /admin h1 "Admin" setup card "Manage the {y} bracket", with…                   | 4.8, 4.12                                                                                                                                                                              |
| DV3    | /admin, current card Open or In progress                                       | 3.23, 4.40                                                                                                                                                                             |
| DV4    | /admin, current card Complete                                                  | 11.3                                                                                                                                                                                   |
| DV5    | /admin h1 "Admin" links Past years, Reports (n), Educators,…                   | 3.23, 4.8, 13.3                                                                                                                                                                        |
| DV6    | /admin/bracket, empty form (no Phase)                                          | 4.26                                                                                                                                                                                   |
| DV7    | /admin/bracket, Phase, filled form, and Delete                                 | 4.9, 11.6, 16.19                                                                                                                                                                       |
| DV8    | /admin/bracket h1 "{y} bracket" publish dialog with or without the…            | 4.10, 11.7, 11.12                                                                                                                                                                      |
| DV9    | /admin/bracket h1 "{y} bracket" error summary above the form                   | 4.13, 4.14                                                                                                                                                                             |
| DV10   | /admin/bracket h1 "{y} bracket" paste error "Found N names. Paste…             | 4.27                                                                                                                                                                                   |
| DV11   | /admin/bracket h1 "{y} bracket" redirect /admin/results                        | 4.33                                                                                                                                                                                   |
| DV12   | /admin/results, Open, no contests                                              | 4.32, 12.11                                                                                                                                                                            |
| DV13   | /admin/results, Open, contests                                                 | 8.1, 9.1                                                                                                                                                                               |
| DV14   | /admin/results h1 "{y} bracket" In progress, results: no action                | 9.5                                                                                                                                                                                    |
| DV15   | /admin/results, In progress, no results                                        | 10.1                                                                                                                                                                                   |
| DV16   | /admin/results, Complete                                                       | 11.2                                                                                                                                                                                   |
| DV17   | /admin/results h1 "{y} bracket" Merges group under Combatants                  | 9.64, 9.65                                                                                                                                                                             |
| DV18   | /admin/results h1 "{y} bracket" redirect /admin                                | 4.7                                                                                                                                                                                    |
| DV19   | /admin/reports: empty, list, pages                                             | 7.9, 7.15, 14.18                                                                                                                                                                       |
| DV20   | /admin/educators form only / found card confirmed (Change address)…            | 7.37, 7.38, 7.39, 7.40, 7.42, 16.27                                                                                                                                                    |
| DV21   | /admin/contests "No contests yet." / list / Pages "Page 1 of 2".…              | 7.16, 7.36, 14.17                                                                                                                                                                      |
| DV22   | /admin/contests/:id: empty, list, deleted, unknown                             | 7.21, 7.22, 7.35                                                                                                                                                                       |
| DV23   | /admin/organizations "No organizations yet." / list / inline rename…           | 7.53, 7.55                                                                                                                                                                             |
| DV24   | action-only URLs by GET redirect to their page: bracket/delete,…               | 7.63                                                                                                                                                                                   |
| DV25   | /admin/organizations/data?domain= JSON counts, admin only                      | 7.61, 7.62                                                                                                                                                                             |
| DV26   | /bracket: none published, Open, with results                                   | 1.2, 4.5, 8.4                                                                                                                                                                          |
| DV27   | / signed out and signed in                                                     | 1.1, 1.25, 4.4, 4.34, 12.21                                                                                                                                                            |
| DX1a   | /contests, no year                                                             | 4.3                                                                                                                                                                                    |
| DX1b   | /contests, open                                                                | 5.1                                                                                                                                                                                    |
| DX1c   | /contests, in progress / complete                                              | 9.11                                                                                                                                                                                   |
| DX1d   | /contests, archived                                                            | 12.4                                                                                                                                                                                   |
| DX2b   | contest page, open                                                             | 5.10                                                                                                                                                                                   |
| DX2c   | contest page, in progress / complete                                           | 9.13                                                                                                                                                                                   |
| DX2d   | contest page, archived                                                         | 13.7                                                                                                                                                                                   |
| DX3a   | leaderboards, no year                                                          | 4.6                                                                                                                                                                                    |
| DX3b   | leaderboards, open                                                             | 5.59, 5.68, 6.25                                                                                                                                                                       |
| DX3c   | leaderboards, in progress / complete                                           | 9.27                                                                                                                                                                                   |
| DX3d   | leaderboards, archived                                                         | 13.4, 13.6                                                                                                                                                                             |
| DX4b   | contest link, open                                                             | 6.1                                                                                                                                                                                    |
| DX4c   | contest link, in progress / complete                                           | 9.17                                                                                                                                                                                   |
| DX4d   | contest link, archived                                                         | 13.16                                                                                                                                                                                  |
| DX5b   | player bracket, open                                                           | 6.5                                                                                                                                                                                    |
| DX5c   | player bracket, in progress / complete                                         | 9.19                                                                                                                                                                                   |
| DX5d   | player bracket, archived                                                       | 12.5, 13.13                                                                                                                                                                            |
| DX6a   | create contest POST, no year                                                   | 4.2                                                                                                                                                                                    |
| DX6b   | create contest POST, open                                                      | 5.9                                                                                                                                                                                    |
| DX6c   | create contest POST, in progress / complete                                    | 9.6                                                                                                                                                                                    |
| DES1   | Admin educator: confirmed                                                      | 7.42                                                                                                                                                                                   |
| DES2   | Admin educator: unconfirmed signed up                                          | 7.40                                                                                                                                                                                   |
| DES3   | Admin educator: unconfirmed imported                                           | 7.41, 14.49                                                                                                                                                                            |
| DO1    | Organization: not named                                                        | 7.53                                                                                                                                                                                   |
| DO2    | Organization: named                                                            | 7.53                                                                                                                                                                                   |
| DO3    | Organization: empty, 0 educators                                               | 7.53                                                                                                                                                                                   |
| DO4    | Organization: rename                                                           | 7.54                                                                                                                                                                                   |
| DO5    | Organization: gone                                                             | 7.58, 7.59                                                                                                                                                                             |
| DO6    | Organization: delete data                                                      | 7.55, 7.57, 14.52                                                                                                                                                                      |
| DO7    | Organization: delete errors                                                    | 7.56, 7.59, 7.60                                                                                                                                                                       |
| DO8    | Organization: starts again at sign-in                                          | 1.32, 7.52                                                                                                                                                                             |
| DN1    | Admin report: two readers separate                                             | 7.9                                                                                                                                                                                    |
| DN2    | Admin report: repeat un-dismisses                                              | 7.12                                                                                                                                                                                   |
| DN3    | Admin report: trash hides, restore shows                                       | 7.13, 7.14                                                                                                                                                                             |
| DN4    | Admin report: refused, gone                                                    | 14.54, 14.55                                                                                                                                                                           |
| DJ1    | Daily job: erase self-deleted players                                          | 14.5                                                                                                                                                                                   |
| DJ2    | Daily job: delete expired sessions and links                                   | 14.4                                                                                                                                                                                   |
| DJ3    | Daily job: replace names and delete reports                                    | 14.7                                                                                                                                                                                   |
| DJ4    | Daily job: unlocked year keeps names                                           | 14.6                                                                                                                                                                                   |
| DJ5    | Daily job: failed step doesn’t stop others                                     | 14.10                                                                                                                                                                                  |
| DJ6    | Daily job: runs at start                                                       | 14.11                                                                                                                                                                                  |
| DJ7    | Daily job: runs at 02:00 Arizona                                               | 14.12                                                                                                                                                                                  |
| DI3    | Import and launch: launch waiting                                              | 7.41, 14.49                                                                                                                                                                            |
| DI4    | Import and launch: launch emailed                                              | 14.51                                                                                                                                                                                  |
| DI5    | Import and launch: launch confirmed                                            | 14.50                                                                                                                                                                                  |
| DI7    | Import and launch: launch link expired                                         | 14.49                                                                                                                                                                                  |
| AR1    | Return path: sent to sign in with the page’s path                              | 16.2                                                                                                                                                                                   |
| AR2    | Return path: returns after a wrong password                                    | 16.3                                                                                                                                                                                   |
| AR3    | Return path: returns through the code and recovery code pages                  | 16.4, 16.5                                                                                                                                                                             |
| AR4    | Return path: returns with a passkey                                            | 16.6                                                                                                                                                                                   |
| AR5    | Return path: keeps a leaderboard’s page number                                 | 16.7                                                                                                                                                                                   |
| AR6    | Return path: signed in already, goes to the page                               | 16.8                                                                                                                                                                                   |
| AR7    | Return path: address to another site refused                                   | 16.9                                                                                                                                                                                   |
| AR8    | Return path: address that holds a secret or only acts refused                  | 16.10                                                                                                                                                                                  |
| AR9    | Return path: setup link loses its token and still works                        | 16.11, 16.12                                                                                                                                                                           |
| AJ1    | Forms without JavaScript: sign-in form                                         | 16.30                                                                                                                                                                                  |
| AJ2    | Forms without JavaScript: player’s name form                                   | 16.31                                                                                                                                                                                  |
| AJ3    | Forms without JavaScript: no address sent to other sites                       | 16.32                                                                                                                                                                                  |
| AK1    | Accounts: password prompts share one limit                                     | 14.24                                                                                                                                                                                  |
| AK2    | Accounts: right password gives the attempts back                               | 14.23                                                                                                                                                                                  |
| AK3    | Accounts: app turned off in another tab                                        | 3.66                                                                                                                                                                                   |
| AK4    | Accounts: app setup restarted or finished in another tab                       | 3.17, 3.18, 3.24                                                                                                                                                                       |
| AK5    | Accounts: leftover app row replaced                                            | 3.68, 3.69                                                                                                                                                                             |
| AK6    | Accounts: verify page with a passkey and an app                                | 3.52                                                                                                                                                                                   |
| AK7    | Accounts: session without any second factor left                               | 3.67                                                                                                                                                                                   |
| AK8    | Accounts: notice: too many codes                                               | 3.30                                                                                                                                                                                   |
| AK9    | Accounts: notice: address changed                                              | 7.48                                                                                                                                                                                   |
| AK10   | Accounts: forgot password while signed in                                      | 1.29, 1.30                                                                                                                                                                             |
| AK11   | Accounts: address already has an account                                       | 14.29                                                                                                                                                                                  |
| AK12   | Accounts: account deleted notice and gone account                              | 7.65, 15.37                                                                                                                                                                            |
| AK13   | Accounts: admin link in the header and in the admin area                       | 3.2, 3.3, 3.25                                                                                                                                                                         |
| AK14   | Accounts: error page and not-found page say what to do                         | 1.4, 14.40                                                                                                                                                                             |
| AK15   | Accounts: recovery code used in 2 tabs                                         | 3.70                                                                                                                                                                                   |
| PT1    | Stale player tab: save refused, draft                                          | 15.16, 15.18                                                                                                                                                                           |
| PT2    | Stale player tab: save refused, submitted                                      | 15.23                                                                                                                                                                                  |
| PT3    | Stale player tab: submit refused                                               | 15.20                                                                                                                                                                                  |
| PT4    | Stale player tab: discard refused                                              | 15.22                                                                                                                                                                                  |
| PT5    | Stale player tab: forget refused                                               | 15.24                                                                                                                                                                                  |
| PT6    | Stale player tab: delete refused                                               | 15.25                                                                                                                                                                                  |
| PT7    | Stale player tab: page without the player’s ID refused                         | 15.26, 15.27, 15.28                                                                                                                                                                    |
| PT8    | Stale player tab: refusal remembers no one longer                              | 15.17                                                                                                                                                                                  |
| PT9    | Stale player tab: orphaned wording                                             | 15.29                                                                                                                                                                                  |
| CN1    | Contests: hidden contest note                                                  | 7.18, 7.19                                                                                                                                                                             |
| CN2    | Contests: expected lock date on the dashboard and the player’s bracket         | 8.3                                                                                                                                                                                    |
| CN3    | Contests: link to the current bracket on the dashboard                         | 5.1                                                                                                                                                                                    |
| CN4    | Contests: orphaned statuses and deletions                                      | 7.75, 7.76, 7.78, 7.79                                                                                                                                                                 |
| CN5    | Contests: locked bracket with picks cleared by a move                          | 9.73, 9.74                                                                                                                                                                             |
| CN6    | Contests: forgotten page in each year state                                    | 6.32, 9.26, 12.5                                                                                                                                                                       |
| CN7    | Contests: “Not a real player” left out for a contest’s name                    | 7.1, 7.3                                                                                                                                                                               |
| CN8    | Contests: player named Player can be reported                                  | 7.24                                                                                                                                                                                   |
| CN9    | Contests: delete dialog counts                                                 | 5.15, 5.16, 7.69                                                                                                                                                                       |
| CN10   | Contests: past trash and past deletion wording                                 | 13.10                                                                                                                                                                                  |
| CP1    | Podium: 1 row                                                                  | 9.53                                                                                                                                                                                   |
| CP2    | Podium: 1, 2, 3                                                                | 9.46                                                                                                                                                                                   |
| CP3    | Podium: 1, 1, 3                                                                | 9.47                                                                                                                                                                                   |
| CP4    | Podium: 1, 2, 2                                                                | 9.48                                                                                                                                                                                   |
| CP5    | Podium: 1, 2, 3, 3                                                             | 9.49                                                                                                                                                                                   |
| CP6    | Podium: 1, 1, 1, 1                                                             | 9.50                                                                                                                                                                                   |
| CP7    | Podium: some without points                                                    | 9.51                                                                                                                                                                                   |
| DM1    | Admin: rename a contest                                                        | 7.25, 7.26, 7.27, 7.33                                                                                                                                                                 |
| DM2    | Admin: delete a contest forever                                                | 7.29, 7.31, 7.34                                                                                                                                                                       |
| DM3    | Admin: delete a contest forever, refused                                       | 7.30, 7.32                                                                                                                                                                             |
| DM4    | Admin: hide, show, hand over on the contest’s page                             | 7.28                                                                                                                                                                                   |
| DM5    | Admin: hand over a trashed contest                                             | 7.81, 7.82, 7.83, 7.84, 7.85                                                                                                                                                           |
| DM6    | Admin: report opens the contest                                                | 7.10                                                                                                                                                                                   |
| DM7    | Admin: rename a division                                                       | 8.12                                                                                                                                                                                   |
| DM8    | Admin: rename a division, refused                                              | 8.9, 8.10, 8.11, 12.20                                                                                                                                                                 |
| DM9    | Admin: stale save refused                                                      | 4.18, 4.22                                                                                                                                                                             |
| DM10   | Admin: “Save these names anyway”                                               | 4.19, 4.25                                                                                                                                                                             |
| DM11   | Admin: stale publish refused                                                   | 4.16                                                                                                                                                                                   |
| DM12   | Admin: stale delete refused                                                    | 4.17                                                                                                                                                                                   |
| DM13   | Admin: same names saved again                                                  | 4.20                                                                                                                                                                                   |
| DM14   | Admin: form kept when the second factor or session ends                        | 14.30, 14.31, 14.32                                                                                                                                                                    |
| DM15   | Admin: results count in Complete and the publish dialog                        | 11.2, 11.7                                                                                                                                                                             |
| DM16   | Admin: older unpublished bracket                                               | 14.13, 14.14, 14.15                                                                                                                                                                    |
| DM17   | Admin: swaps that cancel out                                                   | 8.15, 8.16, 8.17                                                                                                                                                                       |
| DM18   | Admin: move that clears nothing                                                | 4.31                                                                                                                                                                                   |
| DM19   | Admin: past expected lock date hidden                                          | 10.12                                                                                                                                                                                  |
| RG1    | Refusal keeps its dialog and page                                              | 3.54, 4.16, 4.17, 4.23, 4.24, 4.36, 8.20, 10.4, 10.6, 11.9, 11.10, 12.8, 12.9, 12.15, 12.18, 15.2, 15.4, 15.5, 15.6, 15.7, 15.8, 15.10, 15.11, 15.12, 15.26, 15.27, 15.34, 15.35       |
| RG2    | Refusal offers Reload                                                          | 3.54, 4.16, 4.17, 4.23, 4.36, 4.37, 8.20, 9.61, 10.4, 10.6, 10.7, 11.9, 12.8, 12.10, 12.15, 12.18, 15.2, 15.4, 15.5, 15.6, 15.7, 15.8, 15.10, 15.11, 15.12, 15.26, 15.27, 15.34, 15.35 |
| RG3    | Focus returns after an inline rename                                           | 5.13, 5.14, 8.8, 16.20                                                                                                                                                                 |
| RG4    | Selecting a row near the bottom doesn’t scroll the page                        | 5.25, 5.26                                                                                                                                                                             |
| RG5    | Messages about picks stay in view                                              | 6.7, 6.9                                                                                                                                                                               |
| RG6    | Focus after an empty side’s menu                                               | 16.21, 16.22                                                                                                                                                                           |
| RG7    | Past expected lock date hidden on every page                                   | 10.12                                                                                                                                                                                  |
| RG8    | Focus outline on sides                                                         | 16.21, 16.22                                                                                                                                                                           |
| RG9    | Refused result returns to what’s saved                                         | 9.61, 12.19                                                                                                                                                                            |
| RG10   | Merge cleared in one press                                                     | 9.67, 9.68, 9.69                                                                                                                                                                       |
| RG11   | Saved notice leaves after a later action                                       | 5.60, 7.28                                                                                                                                                                             |
| RG12   | “Saved” beside a renamed name                                                  | 8.8, 8.12, 9.65                                                                                                                                                                        |
| RG13   | Focus moves on when a control leaves                                           | 5.3, 5.36, 6.37                                                                                                                                                                        |
