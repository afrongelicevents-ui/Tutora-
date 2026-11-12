# 04 · Feature map: what exists, what to extend, what is new

Audited from the code on 12 November 2026 (branch `ccr-767e9d9a-el14qg`). Prices and free-tier limits are listed with sources in `10-technical-recommendation.md` (checked 12 Nov 2026 — check before buying).

## How to read the cost column

"Extra monthly cost" means extra running cost for Tutora (hosting, database, storage, messaging), **not** build effort.

- Today Tutora runs on **Cloudflare Workers Free** (100,000 requests a day) and **Neon Free** (0.5 GB storage per project — one Neon page says 1 GB, so check — and 100 compute-hours a month). Files are stored **inside the database** unless an R2 bucket is connected (`src/lib/server/storage.ts`).
- Most new pages are text rows and a few page views, so they cost **$0 extra while we stay inside those free limits**.
- The three things that will push Tutora off the free tiers first are:
  1. **Database storage (0.5 GB)** — filled mainly by uploaded files (homework photos, payment proofs, lesson files) because they live in the database today.
  2. **Database compute hours (100/month)** — the database wakes for any request; busy days and lesson rooms keep it awake. A month has about 730 hours, so a database kept awake all month at 1 compute unit would need about 730 compute-hours — more than the free 100. (Smaller sizes use fewer per hour.)
  3. **Worker requests (100,000/day)** — the lesson room checks for set-up messages every 1.5 s while connecting and every 4 s once live (`src/lib/room-client.ts`). That is about 900 requests per person per hour, so a one-hour one-to-one lesson is about 1,800 requests. On its own that would allow roughly 55 one-hour lessons a day before the free cap (100,000 ÷ 1,800), less once normal page views are added.
- Messaging (SMS, WhatsApp, email beyond free tiers) is the only feature with a true per-use cost. See `06-notifications-and-reminders.md`.

## Public

| Page              | Status | What exists (route/file)                                                                     | What is missing                                                    | Extra monthly cost       |
| ----------------- | ------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------ |
| Homepage          | Exists | `/` — hero (owner photo), how it works, popular tutors (real only), tutor band; ~60 KB (D62) | New positioning line, pillars summary, link to How it works        | $0                       |
| Find a tutor      | Exists | `/tutors` — filters, sort, "Load more" without JS (D64)                                      | Filter by "exam preparation"/"stay ahead"; link to subject pages   | $0                       |
| Subject discovery | New    | Only the subject filter; standard subjects in `platform_subject`                             | `/subjects` index and `/subjects/[name]` listing tutors and levels | $0 (cached public pages) |
| Tutor profile     | Exists | `/t/[slug]` + about, subjects, results (consent, D27), reviews                               | Show which pillars the tutor offers (assessments, accountability)  | $0                       |
| How Tutora works  | New    | Short section on homepage                                                                    | Full page for families and tutors; free vs premium explained       | $0                       |
| Register          | Exists | `/signup` (student/parent), `/join/signup` (tutor)                                           | Parent path: "add your children" straight after sign-up            | $0                       |
| Login             | Exists | `/login`, `/login/2fa`, forgot/reset password                                                | —                                                                  | $0                       |
| Partnership info  | New    | —                                                                                            | `/partnership` explanation page                                    | $0                       |

## Student

| Page                  | Status | What exists                                                                            | What is missing                                  | Extra monthly cost                                  |
| --------------------- | ------ | -------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| Overview              | Exists | `/student` — needs attention, requests, upcoming/past lessons, my tutors, saved tutors | Today's check-in card, next assessment           | $0                                                  |
| My lessons            | Extend | Lists on `/student`                                                                    | Own page with filters                            | $0                                                  |
| Lesson details / join | Exists | `/student/lessons/[id]`, `/room/[id]`, `.ics` at `/lessons/[id]/ics`                   | Show outside meeting link if set                 | $0                                                  |
| Homework              | Exists | `/student/homework` — hand in photo/PDF, feedback                                      | Per child; link to topic                         | $0 until files fill the DB (see note)               |
| Assessment centre     | New    | —                                                                                      | Take tutor-made assessments                      | $0 (text rows)                                      |
| My results            | New    | —                                                                                      | Marks and comments                               | $0                                                  |
| My progress           | New    | —                                                                                      | Understanding/engagement/consistency per subject | $0                                                  |
| Study schedule        | New    | —                                                                                      | Plan by subject and day                          | $0                                                  |
| Daily check-ins       | New    | —                                                                                      | 30-second form                                   | $0 in-app/push; email/SMS/WhatsApp cost per message |
| Notifications         | Exists | `/notifications` (bell); prefs in `/account`                                           | Phone push (Web Push)                            | $0 (Web Push has no per-message fee)                |
| Messages & feedback   | New    | Homework feedback only; room chat is not saved (D57)                                   | Saved tutor ↔ family notes                       | $0                                                  |
| Profile / settings    | Exists | `/account`, `/account/password`, `/account/2fa`, `/account/export`, delete             | Reminder time and channel                        | $0                                                  |

## Parent

| Page                 | Status | What exists                                           | What is missing                                      | Extra monthly cost                                                |
| -------------------- | ------ | ----------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| Overview             | Extend | Parents land on `/student`                            | `/parent` with one card per child                    | $0                                                                |
| Children management  | Exists | `/student/children` (add/remove; `child` table)       | Link a child's own login; move to `/parent/children` | $0                                                                |
| Child dashboard      | New    | —                                                     | Per-child summary                                    | $0                                                                |
| Subject performance  | New    | —                                                     | Per subject results + topic                          | $0                                                                |
| Study accountability | New    | —                                                     | Plan vs check-ins                                    | $0                                                                |
| Homework             | Extend | `/student/homework` (per account, **not per child**)  | `homework.child_id`                                  | $0                                                                |
| Assessment results   | New    | —                                                     | Per child                                            | $0                                                                |
| Tutor feedback       | New    | Homework feedback exists                              | All feedback in one place                            | $0                                                                |
| Lesson history       | Extend | Past lessons on `/student`                            | Per child                                            | $0                                                                |
| Attendance           | Extend | `attendee.attendance` (completed/absent) set by tutor | Show per child                                       | $0                                                                |
| Payments & receipts  | Exists | `/student/payments`, PDF receipts, packages           | Move under `/parent`                                 | $0                                                                |
| Academic reports     | New    | —                                                     | Monthly PDF per child                                | $0 (PDF made on request with `pdf-lib`, not stored)               |
| Academic Partnership | New    | —                                                     | Consent flow, access log                             | $0 hosting; payment collection costs if charged (`07-revenue.md`) |
| Notifications        | Exists | `/notifications`                                      | Weekly summary                                       | $0 in-app/push                                                    |
| Account              | Exists | `/account`                                            | —                                                    | $0                                                                |

## Tutor

| Page                       | Status | What exists                                                                       | What is missing                                    | Extra monthly cost |
| -------------------------- | ------ | --------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------ |
| Overview                   | Exists | `/tutor` "Today": lessons, requests, payments, activity                           | Lesson briefs, marking queue                       | $0                 |
| Calendar & availability    | Exists | `/tutor/calendar` (day/week/month, blocks), `/tutor/settings/times`               | Optional Google Calendar sync (defer)              | $0                 |
| Bookings                   | Extend | Requests handled on `/tutor`                                                      | Own list page with history                         | $0                 |
| Student directory          | Exists | `/tutor/students`                                                                 | Filter by subject/level                            | $0                 |
| Student profile            | Exists | `/tutor/students/[id]`: level, notes, cash, homework, feedback                    | Curriculum, results, check-ins                     | $0                 |
| Learning history           | Extend | Lesson notes per student                                                          | Timeline across lessons, homework, assessments     | $0                 |
| Assignments / homework     | Exists | `/tutor/homework` (several students at once, mark checked)                        | Pick the child; topic tag                          | $0                 |
| Assessment creation        | New    | —                                                                                 | Question builder (MCQ, short answer, photo answer) | $0                 |
| Marking                    | New    | Homework "checked" only                                                           | Marks, comments, recommendations                   | $0                 |
| Feedback & recommendations | New    | —                                                                                 | Per student                                        | $0                 |
| Accountability overview    | New    | —                                                                                 | Check-ins of their students (if shared)            | $0                 |
| Curriculum & textbook info | New    | —                                                                                 | View/verify entries                                | $0                 |
| Partnership workspace      | New    | —                                                                                 | Messages with teacher                              | $0                 |
| Earnings                   | Exists | `/tutor/payments` (Money), receipts, CSV export                                   | Commission statement (if commission starts)        | $0                 |
| Profile / settings         | Exists | `/tutor/settings/[section]` (9 sections), wizard, `/tutor/more`, `/tutor/reviews` | Outside meeting link setting                       | $0                 |

## Admin

| Page                   | Status | What exists                                                                     | What is missing                                                    | Extra monthly cost                              |
| ---------------------- | ------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| Overview               | Extend | `/owner` = tutor list, approvals, add tutor, reset student password, test reset | Summary numbers (real only)                                        | $0                                              |
| Tutor management       | Exists | In `/owner`                                                                     | Move to `/owner/tutors`                                            | $0                                              |
| Students               | Exists | `/owner/students` (search, suspend; includes parents)                           | —                                                                  | $0                                              |
| Parents                | New    | Mixed in with students                                                          | Split view                                                         | $0                                              |
| Schools                | New    | —                                                                               | Add/verify schools and teachers                                    | $0                                              |
| Bookings               | Exists | `/owner/bookings`                                                               | —                                                                  | $0                                              |
| Payment monitoring     | Exists | `/owner/payments` (7-day unconfirmed flag)                                      | Paynow payouts if Tutora collects money                            | Provider fees per transaction (`07-revenue.md`) |
| Reports & analytics    | New    | —                                                                               | Counts from real data                                              | $0                                              |
| Subjects & curriculum  | Extend | `/owner/content` subjects list                                                  | Curriculum names (e.g. "ZIMSEC O Level") — no invented topic lists | $0                                              |
| Partnership management | New    | —                                                                               | Consents, withdrawals, access log                                  | $0                                              |
| Help requests          | Exists | In `/owner/reports`                                                             | Own page                                                           | $0                                              |
| Settings               | Exists | `/owner/account`                                                                | —                                                                  | $0                                              |
| Security & audit logs  | Extend | `/owner/audit` (owner actions only)                                             | Data access log for partnership and children's data                | $0 (text rows; prune after retention period)    |

**Note on files:** homework, assessment photo answers and partnership attachments all add files. While files live in the database, they eat the 0.5 GB. Plan to connect R2 (10 GB free) before the database is about two-thirds full. See `10-technical-recommendation.md`.

## Duplicated or overlapping things found in the audit

| What                                 | Where                                                                                                                                                                                                                                                | Suggestion                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Parents and students share one area  | `/student` for both roles (`student/+layout.server.ts`)                                                                                                                                                                                              | Give parents `/parent` (Phase 2)                                                |
| Two ways to store a child            | `profile.child_name` (old, D10) and the `child` table (D66). Tutor student search still searches `profile.child_name` (`src/lib/server/people.ts`)                                                                                                   | Move everything to `child`; drop the old field later                            |
| Homework has no child                | `homework` table has `user_id` only; bookings and attendees have `child_id`                                                                                                                                                                          | Add `homework.child_id`                                                         |
| "Reports" means two things           | `/owner/reports` = reported reviews + help requests; brief wants analytics                                                                                                                                                                           | Rename to "Moderation" and "Help"; use "Analytics" for numbers                  |
| Planning docs disagree with the code | `docs/PLAN.md` says Durable Objects for the room, Cron Triggers for reminders, R2 for files; the code uses database signalling (D20), GitHub Actions (D24/D72) and database file storage by default (D39). D17 (R2) and D39 (database) also disagree | Treat `DECISIONS.md` D39+ and the code as the truth; mark PLAN.md as historical |
| PWA half-done                        | `static/manifest.webmanifest` exists; there is **no service worker** in `src/`                                                                                                                                                                       | Needed for Web Push (Phase 3)                                                   |
| Two sign-up pages                    | `/signup` (families) and `/join/signup` (tutors)                                                                                                                                                                                                     | Fine — different people; keep                                                   |
| Two decisions on reviews             | D26 then D69 (stricter)                                                                                                                                                                                                                              | D69 is current                                                                  |
| Two decisions on room opening time   | D35 (30 min) then D71 (10 min)                                                                                                                                                                                                                       | D71 is current                                                                  |
| Audit only for owner                 | `audit_log` written only from `owner.ts`                                                                                                                                                                                                             | Extend to sensitive reads (Phase 6)                                             |
| WhatsApp everywhere as links         | `WhatsAppButton.svelte`, reminder links (D25)                                                                                                                                                                                                        | Keep — free and familiar                                                        |
