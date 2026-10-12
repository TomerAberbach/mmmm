# Glossary

Identifiers, tests, docs, and commit descriptions use these terms exactly. UI
copy may use everyday phrasing where players expect it, such as "your bracket"
for a **Player**'s **Draft** or **Submission**.

## Tournament

| Term              | Definition                                                                                                    | Aliases to avoid                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Year**          | One March Mammal Madness tournament and everything in it                                                      | Season, tournament year, March year     |
| **Current year**  | The **Year** with the newest published **Bracket**                                                            | Active year, latest year                |
| **Upcoming year** | The **Year** whose **Bracket** ASU publishes next                                                             | Next year, next season                  |
| **Phase**         | Where a **Year** stands: Setup, Open, In progress, Complete, or Archived                                      | Status, stage, bracket phase            |
| **Bracket**       | A **Year**'s **Divisions**, **Combatants**, seeds, and **Wild card**, either unpublished or published         | Tournament, draft bracket               |
| **Division**      | One of the 4 named groups of seeds 1 to 16 in a **Bracket**                                                   | Region, quadrant                        |
| **Seed slot**     | A position from 1 to 16 within a **Division**                                                                 | Seed position, leaf                     |
| **Combatant**     | An entrant in the **Bracket**, with a name and a seed                                                         | Animal, mammal, contestant, entry, team |
| **Wild card**     | The play-in **Battle** of 2 to 4 entrants whose winner fills one **Seed slot**                                | Play-in, wild card competition          |
| **Round**         | One stage of the **Bracket**: Wild card, Round 1, Round 2, Sweet 16, Elite Trait, Final Roar, or Championship | Elite 8, Final Four, finals             |
| **Battle**        | One matchup in a **Round**                                                                                    | Game, match, matchup                    |
| **Result**        | The admin's record of who won a **Battle**                                                                    | Winner announcement, outcome            |
| **Merge**         | A **Result** where both sides of a **Battle** advance together under a combined name                          | Tie, Tag Team                           |
| **Lock**          | The state, set by the first saved **Result**, in which **Players** can't submit or edit                       | Deadline, close, freeze                 |

## People

| Term                  | Definition                                                             | Aliases to avoid                  |
| --------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| **Admin**             | An **Educator** whose confirmed email address is on the **Admin list** | Operator, superuser               |
| **Admin list**        | The admin email addresses in the app's configuration                   | `ADMIN_EMAIL`                     |
| **Educator**          | A person who signs up and runs **Contests**                            | Teacher, user, account            |
| **Player**            | A person who fills out a bracket through a **Contest link**            | Student, participant, submitter   |
| **Organization**      | The **Educators** who share a confirmed email domain                   | School, district                  |
| **Credential**        | One way an **Educator** signs in, such as an email and password        | Account, login                    |
| **Session**           | One signed-in browser of an **Educator**                               | Login                             |
| **Confirmation link** | The emailed link that confirms an **Educator**'s email address         | Verification link, verify link    |
| **Reset link**        | The emailed link that sets a new password for an **Educator**          | Password reset token, reset token |

## Contests

| Term               | Definition                                                                                                          | Aliases to avoid                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Contest**        | An **Educator**'s group of **Players** for one **Year**                                                             | Class, group, league, pool                |
| **Contest link**   | The shareable link **Players** use to join a **Contest**                                                            | Class link, invite link, join link        |
| **Display name**   | The name a **Player** enters, such as a first name and last initial                                                 | Username, student name, nickname          |
| **Personal link**  | A **Player**'s secret link to their own **Draft** or **Submission** in one **Contest**                              | Recovery link, magic link, sign-in token  |
| **Pick**           | A **Player**'s chosen winner of one **Battle**                                                                      | Choice, guess, prediction                 |
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

| Term                   | Definition                                                            | Aliases to avoid              |
| ---------------------- | --------------------------------------------------------------------- | ----------------------------- |
| **Educator dashboard** | An **Educator**'s list of their **Contests** in the **Current year**  | Home, dashboard, classes page |
| **Past years view**    | The view where **Educators** and **Admins** browse archived **Years** | Archive, history              |

## Relationships

- A **Year** has at most one **Bracket**
- A **Bracket** has exactly 4 **Divisions** and exactly one **Wild card**
- A **Division** has exactly 16 **Seed slots**, and one of them may be filled by
  the **Wild card**'s winner
- A **Battle** has exactly one **Result** once decided
- A **Contest** belongs to exactly one **Educator** and exactly one **Year**
- A **Contest** has exactly one active **Contest link**
- A **Player** has exactly one **Personal link** per **Contest** they join
- A **Draft** becomes exactly one **Submission** when submitted
- An **Educator** belongs to at most one **Organization**
- An **Educator** has one or more **Credentials**
- A **Session** belongs to exactly one **Educator**
- A **Confirmation link** confirms exactly one **Educator**'s email address
- A **Reset link** sets exactly one **Educator**'s password and confirms their
  email address
- A **Contest** counts toward at most one **Organization**
