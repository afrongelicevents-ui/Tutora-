# End-to-end flows

Real browsers, several real test accounts talking to each other, pressing the real buttons.
Every flow runs twice: at phone size (390×844) and at desktop size (1280×800).

| File                     | Flow                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| `booking-payment.e2e.ts` | book → accept → lesson → join room → mark done → pay → confirm → receipt      |
| `homework.e2e.ts`        | set → hand in → mark with a score → feedback → progress → parent told         |
| `checkin.e2e.ts`         | check in → share → study → "How did it go?" → hourly job → parent sees it     |
| `planner.e2e.ts`         | task ticked → personal report → parent sees it only when shared               |
| `family-code.e2e.ts`     | student code → parent connects → parent sees only the shared areas            |
| `buddies.e2e.ts`         | under-13 code swap → each guardian approves → buddies; a decline tells both   |
| `tutor-approval.e2e.ts`  | owner approves a waiting tutor → tutor told → appears in Find a tutor         |
| `messages.e2e.ts`        | messages both ways, unread counts on both sides go back to zero after reading |
| `bell.e2e.ts`            | an event rings the bell → Notifications lists it → the bell is clear          |
| `tools.e2e.ts`           | Connected tools: honest status without keys, every link works, Kahoot! on     |

```sh
# a database with the fake TEST data, and a dev server on it
createdb tutora_e2e
DATABASE_URL=postgres://…/tutora_e2e pnpm db:migrate
DATABASE_URL=postgres://…/tutora_e2e TEST_SITE=1 TEST_PASSWORD=Shot-pass-123 npx tsx scripts/deploy/seed-test.ts
# CRON_SECRET: any made-up local value of 24+ characters, so the check-in flow can run the hourly job
DATABASE_URL=postgres://…/tutora_e2e TEST_SITE=1 BETTER_AUTH_SECRET=… ORIGIN=http://localhost:5173 CRON_SECRET=… pnpm dev &

E2E_DB=postgres://…/tutora_e2e E2E_PASSWORD=Shot-pass-123 CRON_SECRET=<same> pnpm test:e2e
```

- The database helper (`sql`) is only used to set up a starting point (e.g. a birthday, a waiting
  tutor), to move time forward (e.g. a lesson to "now") and to check what was saved; every action
  under test is a real click.
- The site limits how often anyone may log in, so each account logs in once and its session is kept
  in `test-results/.auth/`. If a run ever says "login as … failed: Too many tries", wait for the
  time it names (or, on a local database only, empty the `action_limit` table).
- Without `CRON_SECRET` the check-in flow still runs, but skips the hourly-job step (it says so in
  the test's notes). The 8 PM day summary isn't tested end to end: it needs the real clock.
