# Load test

`pnpm load` builds the app, fills a throwaway database with 200 contests of 100
approved submissions, and drives the production server from one process:

1. 200 players open contest links, start brackets, and pick every 3 seconds from
   one IP address, as a school on one network does
2. 60 players read their bracket and leaderboards as fast as they can, first
   alone and then while results are saved one after another

Run it with Docker's Postgres up.

## Results, 2026-11-26

On an M-series laptop with 10 cores, with Postgres in Docker.

| What                                    | Before         | After         |
| --------------------------------------- | -------------- | ------------- |
| Autosaves refused for the school        | 1,470 of 1,870 | 0 of 1,853    |
| Autosave of a growing draft, p95        | Not measured   | 95 ms         |
| Saving a result over 20,000 submissions | 0.5 s          | 0.5 s         |
| Page reads a second, with none saving   | 108            | 115           |
| Page reads a second, while results save | 105            | 97            |
| Page read, p95 at 60 readers            | 527 to 735 ms  | 515 to 698 ms |
| Page read, p95 while results save       | 569 to 764 ms  | 677 to 899 ms |

Runs vary by about 15%, so only the first row shows a change.

## What it found

- **One school could hit the app-wide rate limit.** Each pick is a request, and
  the limit was 1,000 a minute for each IP address, which 50 players reach. It's
  now 10,000 a minute.
- **The picker told a player over the limit to reload**, as if the bracket had
  changed. It now keeps the picks and offers to try again.
- **Saving a result slows readers by about 15%** while it saves, for half a
  second. Scores are stored in one statement, and ranks are computed when a
  leaderboard is read. The test saves from its own process, so it leaves out the
  save's own CPU time on the server.
- **Page reads are limited by the server's CPU**, since each is rendered by the
  one Node process. Staging's `shared-cpu-1x` has far less CPU than a laptop's
  core, so run production on a `performance-1x` machine in March, and repeat the
  reading part of this test against it before the tournament.
