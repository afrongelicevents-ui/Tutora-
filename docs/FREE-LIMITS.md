# Staying inside the free plans

Tutora runs on free plans only: **Cloudflare Workers Free** (the website), **Neon Free** (the
database) and **GitHub Actions** (deploys and the hourly jobs; free for public repositories).
This page lists the limits, what Tutora uses, how it was measured, and what to do if a limit
gets close. The owner sees live figures in **Owner → Free limits** and gets an alert at 70%.

## The limits (checked 15 Nov 2026)

| Service                     | Limit                                                                                                   | What happens when it is reached                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Cloudflare Workers          | **100,000 requests a day** (resets 00:00 UTC = 2 AM in Zimbabwe), 1,000 a minute                        | Visitors get a Cloudflare error page until the reset. No data is lost.                     |
| Cloudflare Workers          | **10 ms of CPU per request** (waiting for the database does not count)                                  | That request is stopped ("exceeded resources", error 1102/503); the person can try again.  |
| Cloudflare Workers          | 50 outside requests per request, 128 MB memory, 3 MB code (compressed)                                  | The request fails. Tutora uses 2–3 outside requests per page (the database).               |
| Cloudflare Workers Logs     | 200,000 log events a day                                                                                | Older logs are dropped; the site is not affected.                                          |
| Neon                        | **100 compute hours a month** (live and test share it); the database sleeps after 5 minutes without use | Neon pauses the database until next month: pages can't load data. Data is kept.            |
| Neon                        | **0.5 GB storage** (Neon's pages say 0.5 or 1 GB; we plan for 0.5)                                      | Writes fail until data is removed.                                                         |
| Neon                        | 5 GB data sent per month                                                                                | Same as compute: paused until next month.                                                  |
| GitHub Actions              | Free and unlimited for public repositories                                                              | —                                                                                          |
| Resend (email, when set up) | 3,000 emails a month, 100 a day                                                                         | Emails stop until the next day/month; the bell still works.                                |
| Cloudflare Workers AI       | **10,000 neurons a day per account** (live and test share it; resets 00:00 UTC)                         | On the free plan Cloudflare refuses further calls; nothing is charged. Tutora stops first. |

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

## After (test site, 15 Nov 2026)

Cloudflare's own figures, same method (each page warmed once, then 4 visits measured):

|                                           | Before           | After                                         |
| ----------------------------------------- | ---------------- | --------------------------------------------- |
| Median CPU per request                    | 18 ms            | **11 ms**                                     |
| p90                                       | 32 ms            | **19 ms**                                     |
| Requests refused for going over the limit | 15 of 231 (6.5%) | **0 of 248** (and 0 of 156 in the latest run) |
| Test logins that failed                   | 1                | **0**                                         |

| Page                     | Before      | After                                                              |
| ------------------------ | ----------- | ------------------------------------------------------------------ |
| Homepage `/`             | 40          | **0–1** (served from memory)                                       |
| Tutors list, tutor page  | 18–25       | **0–1** (served from memory)                                       |
| Student home             | 37          | **15**                                                             |
| Parent home (new design) | 30          | **15**                                                             |
| Tutor Today              | 29          | **22** (follow-up lookups now batched; re-measure)                 |
| Student progress         | 32          | **13**                                                             |
| Student You page         | 31          | **15**                                                             |
| Tutor More               | 36          | **13**                                                             |
| Owner pages              | —           | **5–9**                                                            |
| Booking page             | 27          | **11**                                                             |
| Login (`POST /login`)    | 10 (p90 42) | 23 (p90 39) — includes the one-time upgrade of old password hashes |

About half of all pages are now at 10 ms or less; the busiest dashboards (tutor Today,
parent booking, tutor calendar "all", the tutor's student page, Earnings) are 18–22 ms.
Cloudflare refused none of them in these runs, but they are above the 10 ms target, so they
stay on the list: next steps are fewer sequential lookups on those five pages (so the
database batch covers more of each page) and paging long lists.

Database driver, same 12 queries on Cloudflare: WebSocket 12 ms, HTTP 9 ms, HTTP batch 4 ms.
Reading pages now use HTTP with automatic batching; form posts keep the WebSocket.

## After the overnight build (test site, 16 Nov 2026)

Tutora Family, Tutora Pro, meeting links, the new owner admin, the question bank, tests and
the AI test maker were added. Same method (`Measure CPU (test site)`), 234 measured requests:

|                                           | Before tonight | After tonight |
| ----------------------------------------- | -------------- | ------------- |
| Median CPU per request                    | 11 ms          | **11 ms**     |
| p90                                       | 19–21 ms       | **18 ms**     |
| Requests refused for going over the limit | 0              | **0**         |
| Errors seen by the visitor                | 0              | **0**         |

Owner pages are 6–19 ms, parent pages 6–22 ms, student pages 6–25 ms, tutor pages 7–19 ms.
Still above 10 ms and on the watch list: signing in (`POST /login`, 44–55 ms: password check
plus the rate-limit and lockout bookkeeping; Cloudflare allowed every one) and the hourly
job endpoint (not used: the jobs run from GitHub Actions). The AI test maker's own CPU is
small: the Worker waits for Cloudflare's AI, which does not count as CPU.

## Tutora recommended tutors (16 Nov 2026)

The parent Tutors page and child page add one batch of five small queries (the children's
level, subjects and tutors); the list of approved tutors with their hours and the owner's
pins is kept in the worker's memory for 5 minutes, so it is not rebuilt on every visit.
Ranking is a few dozen comparisons in memory. Not measured on Cloudflare yet: re-check
with _Measure CPU (test site)_ after deploying.

## Recommended tutors (16 Nov 2026, afternoon)

The two parent pages that show "Tutora recommends" were measured three times on Cloudflare
(test site). Each child's needs are now read in one query instead of five, and the parent
child page no longer runs the topic-scores query twice.

| Run (afternoon, same day)        | `/parent/tutors` | `/parent/child/[id]` | Refused for CPU |
| -------------------------------- | ---------------- | -------------------- | --------------- |
| With recommendations, before fix | 17 ms            | 28 ms                | 7 of 309        |
| After "one query" fix            | 16 ms            | 31 ms                | 0 of 353        |
| After "topic scores once" fix    | 26 ms            | 63 ms                | 1 of 283        |

Daytime runs vary a lot: in the last run pages that were not changed at all (the student's
Family page, sign-in, owner Overview) were about twice as slow as 30 minutes earlier, so the
last row is mostly Cloudflare noise. Query counts are the steadier measure: the child page
now runs 34 queries (was 39) and the Tutors page 15 (was 19). The tutor list used for
recommendations is kept in memory for 5 minutes. Next step if needed: page the child page's
lesson and homework lists.

## Visitor errors in the speed check, and the lighter child page (16 Nov 2026, evening)

**Where the "visitor errors" came from.** The speed check now records every error with its
page, status and what came back, and every Cloudflare log entry that was not "ok". Three
runs 40 minutes apart, with no deploys in between:

| Run (UTC) | Errors seen by the checker              | Cloudflare: refused for CPU | Cloudflare: app errors |
| --------- | --------------------------------------- | --------------------------- | ---------------------- |
| 16:05     | 2 × "no answer" (connection failed)     | 0                           | 0                      |
| 16:45     | 0                                       | 0                           | 0                      |
| 17:26     | 1 × connection failed, 1 × 20 s timeout | 0                           | 0                      |

Every error was a request that never got an answer on the GitHub machine running the check
(status 599: a dropped connection, or our own 20-second limit). Cloudflare logged no error
page, no refusal and no exception for any of them; the one timeout shows in Cloudflare's log
as "canceled" (the checker hung up), with 32 ms of CPU. The earlier noisy run (10 errors)
matches this: Cloudflare logged only 1 CPU refusal and no app errors then, so the other 9
were the same kind of dropped connection. Not a Tutora bug. Note: Cloudflare's live log
drops some events on busy runs (run 1 kept 261 of 432), so a page can be missing from one
run's table.

**Parent child page** (latest 5 lessons and homework, a short progress summary, "See all"
pages; 17 database queries in two rounds instead of 35 one after another):

| Run                   | `/parent/child/[id]` CPU (median) |
| --------------------- | --------------------------------- |
| Before (14:35, 15:23) | 31 ms, 27 ms                      |
| After, run 16:45      | **15 ms**                         |
| After, run 17:26      | **12 ms**                         |
| After, run 16:05      | not in the log (events dropped)   |

## AI test maker (Workers AI)

- **Free allowance only:** 10,000 neurons a day for the whole Cloudflare account. Model
  `@cf/meta/llama-3.2-3b-instruct` (about 4,625 neurons per million input tokens and 30,475
  per million output tokens; Tutora counts 5,000 and 31,000 to stay on the safe side).
- **Our own counter** (`ai_usage` table, `src/lib/server/ai-tests.ts`) adds the estimate for
  the prompt plus the longest possible answer (1,200 tokens) BEFORE each call, and the real
  figure afterwards if Cloudflare reports more. One request costs about 40–50 neurons.
- **Stop lines:** live 6,500 and test 1,500 a day (together 80% of the allowance); one tutor
  1,500 a day (about 30 requests). Then the page says: "AI test maker is resting for today,
  try again tomorrow, or build a test from the question bank." There is no paid fallback.
- **Owner → Free limits** shows today's count against this site's line (live), and the hourly
  reading sends the usual alert at 70% of the line.
- **CPU:** the worker only waits for Cloudflare's answer (waiting is not CPU time) and then
  parses a small JSON reply; the page stays well inside 10 ms of CPU.

## Installed app (service worker), 23 Nov 2026

The service worker adds no work for the Worker: it keeps only static files (icons, fonts,
built code, the offline page), and Cloudflare serves those from its asset store, which is
free and does not count against the 100,000 requests or the CPU limit. Pages and page data
still go to the Worker exactly as before, never from the store. Once installed, repeat
visits fetch fewer files (the shell comes from the phone), so data use goes down. The
worker file itself is about 30 KB and is checked by the browser at most once a day.

## If a limit gets close: what helps first

1. **CPU errors appear** → run _Measure CPU (test site)_, find the heaviest page in the table,
   and cut its database queries (ask once, `perRequest`, one range instead of several).
2. **Requests near 100,000 a day** → most likely a crawler or a loop: check Cloudflare →
   Workers → tutora → Metrics. Public pages are already served from memory.
3. **Neon compute near 100 hours** → the test site is the easiest saving (its hourly jobs run
   every 6 hours already; stop them entirely in `.github/workflows/reminders.yml`).
4. **Neon storage near 0.5 GB** → old notifications and usage snapshots are the biggest
   tables; delete notifications older than a year.
5. **AI test maker resting too early** → lower `MAX_OUT_TOKENS` or the per-tutor cap in
   `src/lib/server/ai-tests.ts`; never raise the stop lines above 80% in total.
6. Only if all of that is not enough: Cloudflare Workers Paid ($5/month) lifts the CPU limit
   to 30 seconds and the requests to 10 million a month. Not done: the free plan was asked for.
