# Glossary

Identifiers, tests, docs, and commit descriptions use these terms exactly. UI
copy may use everyday phrasing where players expect it, such as "your bracket"
for a **Player**'s **Draft** or **Submission**.

## Tournament

| Term                   | Definition                                                                                                                             | Aliases to avoid                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Year**               | One March Mammal Madness tournament and everything in it                                                                               | Season, tournament year, March year     |
| **Current year**       | The **Year** with the newest published **Bracket**                                                                                     | Active year, latest year                |
| **Upcoming year**      | The **Year** whose **Bracket** ASU publishes next                                                                                      | Next year, next season                  |
| **Phase**              | Where a **Year** stands: Setup, Open, In progress, Complete, or Archived                                                               | Status, stage, bracket phase            |
| **Bracket**            | A **Year**'s **Divisions**, **Combatants**, seeds, and **Wild card**, either unpublished or published                                  | Tournament, draft bracket               |
| **Publish**            | To make a **Year**'s **Bracket** available to **Educators**, moving the **Year** from Setup to Open, and **Unpublish** to move it back | Release, go live                        |
| **Division**           | One of the 4 named groups of seeds 1 to 16 in a **Bracket**                                                                            | Region, quadrant                        |
| **Division position**  | Where a **Division** sits on the diagram: top left, bottom left, top right, or bottom right                                            | Corner, quadrant                        |
| **Seed slot**          | A position from 1 to 16 within a **Division**                                                                                          | Seed position, leaf                     |
| **Combatant**          | An entrant in the **Bracket**, with a name and a seed                                                                                  | Animal, mammal, contestant, entry, team |
| **Wild card**          | The play-in **Battle** of 2 to 4 entrants whose winner fills one **Seed slot**                                                         | Play-in, wild card competition          |
| **Round**              | One stage of the **Bracket**: Wild card, Round 1, Round 2, Sweet 16, Elite Trait, Final Roar, or Championship                          | Elite 8, Final Four, finals             |
| **Battle**             | One matchup in a **Round**                                                                                                             | Game, match, matchup                    |
| **Side**               | One of a **Battle**'s places, filled by a **Combatant** or by an earlier **Battle**'s winner                                           | Slot, competitor                        |
| **Contender**          | A **Combatant** who could win a **Battle**, given the **Bracket** alone                                                                | Candidate, possible winner              |
| **Champion**           | The winner of a **Year**'s Championship **Battle**                                                                                     | Winner of the year, title holder        |
| **Result**             | The admin's record of who won a **Battle**                                                                                             | Winner announcement, outcome            |
| **Merge**              | A **Result** where both **Sides** of a **Battle** advance together under a combined name                                               | Tie, Tag Team                           |
| **Lock**               | The state, set by the first saved **Result**, in which **Players** can't submit or edit                                                | Deadline, close, freeze                 |
| **Expected lock date** | The date an **Admin** expects the **Bracket** to **Lock**, shown to **Educators** and **Players** only as a heads-up                   | Lock date, deadline                     |

## People

| Term                  | Definition                                                                                                      | Aliases to avoid                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Admin**             | An **Educator** whose confirmed email address is on the **Admin list**                                          | Operator, superuser               |
| **Admin list**        | The admin email addresses in the app's configuration                                                            | `ADMIN_EMAIL`                     |
| **Educator**          | A person who signs up and runs **Contests**                                                                     | Teacher, user, account            |
| **Player**            | A person's place in one **Contest**, under the **Display name** they enter                                      | Student, participant, submitter   |
| **Organization**      | The **Educators** who share a confirmed email domain                                                            | School, district                  |
| **Credential**        | An **Educator**'s email address and password                                                                    | Account, login                    |
| **Session**           | One signed-in browser of an **Educator**                                                                        | Login                             |
| **Confirmation link** | The emailed link that confirms an **Educator**'s email address                                                  | Verification link, verify link    |
| **Reset link**        | The emailed link that sets a new password for an **Educator**                                                   | Password reset token, reset token |
| **Second factor**     | A **Passkey** or **Authenticator app** that proves an **Educator** is who they say, beyond a password           | 2FA, two-factor, MFA, factor      |
| **Passkey**           | A key on an **Educator**'s device that signs them in after checking a fingerprint, face, or PIN                 | Security key, WebAuthn credential |
| **Authenticator app** | An app that shows an **Educator** a new **Security code** every 30 seconds                                      | TOTP, OTP app, authenticator      |
| **Security code**     | The 6-digit code an **Authenticator app** shows                                                                 | TOTP code, OTP, verification code |
| **Recovery code**     | A single-use code that signs an **Educator** in in place of their **Authenticator app**                         | Backup code                       |
| **Setup link**        | The emailed link that lets a **Session** add an **Admin**'s first **Second factor**                             | Enrollment link                   |
| **Assurance**         | How a **Session**'s **Educator** proved who they are: with a password, a **Setup link**, or a **Second factor** | Session strength, auth level      |

## Contests

| Term               | Definition                                                                                                          | Aliases to avoid                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Contest**        | An **Educator**'s group of **Players** for one **Year**                                                             | Class, group, league, pool                |
| **Contest link**   | The shareable link that opens a **Contest** to its **Players**                                                      | Class link, invite link, join link        |
| **Display name**   | The name a **Player** enters, such as a first name and last initial                                                 | Username, student name, nickname          |
| **Personal link**  | A **Player**'s secret link to their own **Draft** or **Submission** in one **Contest**                              | Recovery link, magic link, sign-in token  |
| **Pick**           | A **Player**'s chosen winner of one **Battle**                                                                      | Choice, guess, prediction                 |
| **Clear**          | To remove a **Pick** whose winner can no longer reach its **Battle** after an earlier **Pick** changes              | Invalidate, reset, drop                   |
| **Draft**          | A **Player**'s **Picks** before they submit them                                                                    | Unsubmitted bracket, fill-out, completion |
| **Submission**     | A submitted set of **Picks** in a **Contest**, with a status of pending, approved, or rejected                      | Entry, fill-out, completion, bracket      |
| **Marked bracket** | A **Player**'s **Picks**, each shown as right or wrong                                                              | Graded bracket, scored bracket            |
| **Share**          | An **Educator**'s grant of one colleague's full view of a **Contest**                                               | Collaborator, co-teacher                  |
| **Trash**          | The holding place for deleted **Contests**, **Drafts**, and **Submissions** until the next **Bracket** is published | Recycle bin, archive                      |

## Leaderboards

| Term            | Definition                                                                                        | Aliases to avoid       |
| --------------- | ------------------------------------------------------------------------------------------------- | ---------------------- |
| **Score**       | The points a **Submission**'s **Picks** have earned from saved **Results**                        | Points, total          |
| **Score tier**  | Every **Submission** with the same **Score**                                                      | Score group, tie group |
| **Leaderboard** | Approved **Submissions** ranked by **Score**, for a **Contest**, an **Organization**, or everyone | Standings, rankings    |

## Views

| Term                   | Definition                                                                        | Aliases to avoid              |
| ---------------------- | --------------------------------------------------------------------------------- | ----------------------------- |
| **Educator dashboard** | An **Educator**'s list of their **Contests** in the **Current year**              | Home, dashboard, classes page |
| **Past years view**    | The view where **Educators** and **Admins** browse archived **Years**             | Archive, history              |
| **Admin area**         | The pages only **Admins** reach, from a **Session** that used a **Second factor** | Admin panel, dashboard        |

## Relationships

- A **Year** has at most one **Bracket**
- A **Bracket** has exactly 4 **Divisions** and exactly one **Wild card**
- A **Bracket** has at most one **Expected lock date**
- A **Division** has exactly 16 **Seed slots**, and one of them may be filled by
  the **Wild card**'s winner
- A **Wild card** has 2 to 4 **Combatants**, and its **Seed slot** holds no
  **Combatant** of its own
- A **Battle** after the **Wild card** has exactly 2 **Sides**
- A **Battle** has 2 or more **Contenders**
- A **Battle** has exactly one **Result** once decided
- A **Contest** belongs to exactly one **Educator** and exactly one **Year**
- A **Contest** has exactly one active **Contest link**
- A **Player** belongs to exactly one **Contest** and has exactly one **Personal
  link**
- A **Contest** has zero or more **Players**
- A **Draft** becomes exactly one **Submission** when submitted
- An **Admin** has at least one **Second factor**
- An **Educator** has zero or more **Passkeys** and at most one **Authenticator
  app**
- An **Authenticator app** has 10 **Recovery codes** when set up, and each works
  once
- An **Educator** belongs to at most one **Organization**
- An **Educator** has one or more **Credentials**
- A **Session** belongs to exactly one **Educator**
- A **Confirmation link** confirms exactly one **Educator**'s email address
- A **Reset link** sets exactly one **Educator**'s password and confirms their
  email address
- A **Contest** counts toward at most one **Organization**
