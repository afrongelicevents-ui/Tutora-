# End-to-end flows

Real browsers, several real test accounts talking to each other, pressing the real buttons.
Every flow runs twice: at phone size (390×844) and at desktop size (1280×800).

| File                     | Flow                                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `booking-payment.e2e.ts` | book → accept → lesson → Join link (room off) → mark done → pay → confirm → receipt                                                                                        |
| `homework.e2e.ts`        | set → hand in → mark with a score → feedback → progress → parent told                                                                                                      |
| `checkin.e2e.ts`         | check in → share → study → "How did it go?" → hourly job → parent sees it                                                                                                  |
| `planner.e2e.ts`         | task ticked → personal report → parent sees it only when shared                                                                                                            |
| `family-code.e2e.ts`     | student code → parent connects → parent sees only the shared areas                                                                                                         |
| `buddies.e2e.ts`         | under-13 code swap → each guardian approves → buddies; a decline tells both                                                                                                |
| `tutor-approval.e2e.ts`  | owner approves a waiting tutor → tutor told → appears in Find a tutor                                                                                                      |
| `owner.e2e.ts`           | approval rules, suspend / restore, hide / show a review, homepage texts                                                                                                    |
| `owner-pages.e2e.ts`     | every admin page, tabs / side sections, search, filters, paging, photos, etc.                                                                                              |
| `messages.e2e.ts`        | messages both ways, unread counts on both sides go back to zero after reading                                                                                              |
| `bell.e2e.ts`            | an event rings the bell → Notifications lists it → the bell is clear                                                                                                       |
| `no-email.e2e.ts`        | email off: sign-up straight in, owner reset link (once), receipt in bell + WhatsApp                                                                                        |
| `tools.e2e.ts`           | Connected tools are shortcuts only (open the app), no sync address, Kahoot! on                                                                                             |
| `pwa.e2e.ts`             | Installed app: manifest, `/app` opens each role's home, offline page, install card once + menu item (service worker itself: `scripts/pwa-check.mjs` on a production build) |
| `simplify.e2e.ts`        | room off by default, homework due time → late photo → parent sees, report PDF, help pages                                                                                  |
| `pro.e2e.ts`             | Free tutor sees Pro + Upgrade → pays → owner confirms → Pro; reports; gifts                                                                                                |

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

## School+ (e2e/school-plus.e2e.ts): selectors the parent pages must keep

The School+ flow walks every status with Mrs Sibanda (parent), Tatenda (child), Chipo (tutor)
and a new schoolteacher who signs up through the invite link. A redesign of the parent
School+ pages must keep these `data-testid`s (or update the test):

| page                             | element                                                                          | data-testid     |
| -------------------------------- | -------------------------------------------------------------------------------- | --------------- |
| `/parent/school-plus?child=<id>` | request form (`select[name=tutor]`, `input[name=subject                          | school          | teacher]`, submit) | `sp-request` |
| same                             | "Find a tutor first" button (child has no tutor)                                 | `sp-find-tutor` |
| `/parent/school-plus/<id>`       | page wrapper with `data-status="<status>"`                                       | `sp-parent`     |
| same                             | consent form (`input[name=consent]` checkbox, `input[name=consentName]`, submit) | `sp-consent`    |
| same                             | stop / withdraw form (submit; needs the `sure` tick)                             | `sp-stop`       |

Tutor (`/tutor/school-plus`): `sp-item` (with `data-status`), `sp-accept`, `sp-decline`
(inside a `<details>`, needs the `sure` tick), `sp-invite`, `sp-invite-link`, `sp-copy-link`.
Answered invite link: `spi-answered` (`data-answered=done|declined`). Parent child page:
`child-school-plus`. Teacher: `spi-signup`, `spi-respond` (buttons `value=1|0`) on
`/school/<token>`; `teacher-partnership` (with `data-status`) on `/teacher/p/<id>`; shared:
`sp-message`, `sp-plan`, `sp-report`, `sp-end`.
Locally email counts as on (dev), so a new teacher confirms their email first: the test sets
`email_verified` and logs in from the invite link. On the test site the teacher is signed in at once.

## Tutora Pro test accounts (test site and local seed)

- `chipo@example.com`: Tutora Pro (paid, receipt P-000001, automatic payment reminders on).
- `tendai@example.com`: Free tutor (Pro features show "Pro" + Upgrade).
- `farai@example.com`: Free tutor whose Pro payment proof waits in Owner → Money → Payments → Tutora Pro.
- The Pro pilot switch is OFF in the test data so Free and Pro look different (it is ON on live).
- `E2E_AUTH_DIR`: a separate folder for saved logins when two local servers are tested at once.

`no-email.e2e.ts` needs a server started with `EMAIL_OFF=1` (as the published site runs
without an email service); on a server with email on, its email-off checks are skipped.
