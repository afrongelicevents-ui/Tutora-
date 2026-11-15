# Staying inside the free plans

Tutora runs on free plans only: **Cloudflare Workers Free** (the website), **Neon Free** (the
database) and **GitHub Actions** (deploys and the hourly jobs; free for public repositories).
This page lists the limits, what Tutora uses, how it was measured, and what to do if a limit
gets close. The owner sees live figures in **Owner → Free limits** and gets an alert at 70%.

## The limits (checked 15 Nov 2026)

| Service                     | Limit                                                                                                   | What happens when it is reached                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Cloudflare Workers          | **100,000 requests a day** (resets 00:00 UTC = 2 AM in Zimbabwe), 1,000 a minute                        | Visitors get a Cloudflare error page until the reset. No data is lost.                    |
| Cloudflare Workers          | **10 ms of CPU per request** (waiting for the database does not count)                                  | That request is stopped ("exceeded resources", error 1102/503); the person can try again. |
| Cloudflare Workers          | 50 outside requests per request, 128 MB memory, 3 MB code (compressed)                                  | The request fails. Tutora uses 2–3 outside requests per page (the database).              |
| Cloudflare Workers Logs     | 200,000 log events a day                                                                                | Older logs are dropped; the site is not affected.                                         |
| Neon                        | **100 compute hours a month** (live and test share it); the database sleeps after 5 minutes without use | Neon pauses the database until next month: pages can't load data. Data is kept.           |
| Neon                        | **0.5 GB storage** (Neon's pages say 0.5 or 1 GB; we plan for 0.5)                                      | Writes fail until data is removed.                                                        |
| Neon                        | 5 GB data sent per month                                                                                | Same as compute: paused until next month.                                                 |
| GitHub Actions              | Free and unlimited for public repositories                                                              | —                                                                                         |
| Resend (email, when set up) | 3,000 emails a month, 100 a day                                                                         | Emails stop until the next day/month; the bell still works.                               |

Sources: [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[Neon free plan](https://neon.com/faqs/free-plan-limits-and-quotas),
[Cache API on workers.dev](https://developers.cloudflare.com/workers/runtime-apis/cache/).

## How CPU was measured

Two ways, both kept in the repository:

1. **On Cloudflare itself** (the real numbers): GitHub → Actions → **Measure CPU (test site)**
   → Run workflow. It visits every page of the test site as the fake test accounts while
   listening to the worker's live log, which reports Cloudflare's own CPU time for each
   request, and prints a table (route → CPU median / p90 / max). `scripts/perf/remote.mjs`.
2. **Locally** (to find the cause): `scripts/perf/measure.mjs` runs the real production build
   with the same Neon driver against a local copy of the test data, and reports CPU and the
   number of database queries per page; `--cpu-prof` shows where the time goes.
   Cloudflare's numbers were about 1.5–2× the local ones.

## Before (test site, 15 Nov 2026, build eeb597d)

Cloudflare's own figures, 231 requests: **median 18 ms, p90 32 ms, max 93 ms**.
**15 requests (6.5%) were refused for going over the CPU limit**, and one test login kept
failing. Heaviest pages (median CPU):

| Page                      | CPU ms      | Database queries |
| ------------------------- | ----------- | ---------------- |
| Homepage `/`              | 40          | 1                |
| Student home `/student`   | 37          | 25               |
| Tutor More `/tutor/more`  | 36          | 30               |
| Student progress          | 32          | 25               |
| Student You `/student/me` | 31          | 30               |
| Parent home `/parent`     | 30          | 27               |
| Tutor Today `/tutor`      | 29          | 35               |
| Booking `/student/book`   | 27          | 17               |
| Tutor student page        | 27          | 27               |
| Tutor Earnings            | 27          | 19               |
| Login (`POST /login`)     | 10 (p90 42) | —                |

## What was found

- Every request rebuilt the sign-in system (Better Auth) and the database layer's relational
  schema: several milliseconds before any page work.
- Every logged-in request read the same user row twice.
- Pages asked for the same thing several times (a student's lessons three times on one page,
  the study plan five times, the tutor's settings two or three times).
- Each database query costs roughly 1 ms of CPU on Cloudflare (building the SQL and decoding
  the answer), so a page with 30 queries cannot fit in 10 ms.
- Passwords were checked with a slow method (scrypt in plain JavaScript, ~80 ms, then
  PBKDF2 at 100,000 rounds, ~14 ms).
- The hourly jobs (check-in follow-ups, day summaries, weekly reports…) were never actually
  run on the real sites.
- The Cloudflare edge cache does not work on `*.workers.dev`, so public pages were rendered
  for every visitor.

## What changed

- **Once per worker, not per request:** the sign-in system is built once and reads each
  request's own database connection; the database layer is made without the unused
  relational schema; date formatters are made once.
- **One query fewer on every logged-in page:** the account flags come with the session.
- **The same lookup runs once per page** (`perRequest` in `src/lib/server/cache.ts`, only for
  reading pages, never for form posts): lessons, settings, availability, subjects, the study
  plan, the planner window.
- **Fewer queries on the heaviest pages:** tutor Today reads one lesson range instead of three
  and the meeting links in one go; the student's subjects in one query instead of four; the
  personal report reads one four-week window instead of three.
- **Public pages from memory:** the homepage, tutor pages, terms… are kept in the worker's
  memory for one minute for visitors who are not logged in (no rendering, no database).
  The page's security policy now uses hashes so a kept page is safe to serve again.
- **Rarely-changing public data** (the subject lists) is kept for five minutes.
- **Login:** passwords use PBKDF2 at 30,000 rounds (~4 ms). Old hashes still work and are
  upgraded at the next sign-in.
- **No heavy work on the website:** every timed job runs hourly from GitHub Actions straight
  against the database (`scripts/deploy/reminders.ts`), using none of the Workers limits.
  The test site's jobs run every 6 hours to save the shared Neon compute hours.
- **Usage is read hourly the same way** (`scripts/deploy/usage.ts`) for Owner → Free limits.

## After

(filled in from the next Cloudflare measurement)

## If a limit gets close: what helps first

1. **CPU errors appear** → run _Measure CPU (test site)_, find the heaviest page in the table,
   and cut its database queries (ask once, `perRequest`, one range instead of several).
2. **Requests near 100,000 a day** → most likely a crawler or a loop: check Cloudflare →
   Workers → tutora → Metrics. Public pages are already served from memory.
3. **Neon compute near 100 hours** → the test site is the easiest saving (its hourly jobs run
   every 6 hours already; stop them entirely in `.github/workflows/reminders.yml`).
4. **Neon storage near 0.5 GB** → old notifications and usage snapshots are the biggest
   tables; delete notifications older than a year.
5. Only if all of that is not enough: Cloudflare Workers Paid ($5/month) lifts the CPU limit
   to 30 seconds and the requests to 10 million a month. Not done: the free plan was asked for.
