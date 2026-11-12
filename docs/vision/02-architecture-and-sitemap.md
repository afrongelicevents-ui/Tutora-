# 02 · Product architecture and sitemap

## 1. How the four portals share one app

- **One website, one database, one login.** Tutora is a single SvelteKit app on Cloudflare Workers with one Neon Postgres database. Everyone logs in at `/login` (D50) and is sent to their own area by role (`src/lib/roles.ts` → `homeFor`).
- **Roles already exist:** `owner`, `tutor`, `student`, `parent` (`src/lib/server/db/auth.schema.ts`, column `user.role`). Parents currently share the student area `/student`.
- **One lock at the door.** `src/hooks.server.ts` calls `areaAccess()` in `src/lib/server/guards.ts` for **every** request, including page-data requests. Each page checks again (`requireRole`, `requireTutor`, `requireOwner`). New portals plug into the same lock.
- **Data separation stays the same.** Every tutor's data carries a `tutor_id` and every query filters by it (D43, tested in `tenancy.db.test.ts`). New tables follow the same rule. Children's data is reachable only by: the parent who owns the child, the child's own student login (if linked), tutors with an accepted lesson for that child, and — only with signed consent — a named school teacher.

### Proposed change: a real Parent portal

Today a parent lands on `/student` and sees the same pages as a student, plus "Children". For the ecosystem, parents need their own home with a child switcher. Proposal:

- New area **`/parent`**, guarded for role `parent` (add `'parent'` to `areaOf()` in `guards.ts`).
- Keep `/student` for students only. Old parent links to `/student/...` redirect to the matching `/parent/...` page for a while.
- A parent can **link a child's own student login** to their child record (optional; younger children can have no login at all).

### Proposed change: school teacher access (Academic Partnership only)

Teachers are **not** a full portal. A teacher gets a limited login (new role `teacher`) that opens only `/partner/...` pages for the children whose parents signed consent naming that teacher. No search, no browsing, no other children. Details in `08-schools-consent-privacy.md`.

## 2. Data model additions, per pillar

In plain words first, then a short table. Nothing here is built yet.

**Pillar 1 · Academic Support** — mostly exists. Add: an optional **external meeting link** on a lesson (for tutors who prefer Google Meet etc.), a **child** link on homework (today homework is per account, so a parent with two children cannot tell whose it is), and saved **messages/feedback** between tutor and family (today only WhatsApp links and unsaved room chat exist).

**Pillar 2 · Study Accountability** — a **study plan** per child (which subjects, which days, how long), **daily check-ins** (what was studied, a 1–3 "how did it go", an optional note) and **reminder preferences** (time of day, channel).

**Pillar 3 · Curriculum Alignment** — per child and subject: **curriculum** (e.g. ZIMSEC O Level Maths — typed by a person, not invented by Tutora), **current topic**, **textbook in use**, **upcoming school tests**, each with "entered by" and "verified by".

**Pillar 4 · Performance Monitoring** — **assessments** made by tutors (questions, mark scheme), **attempts** by students, **marks and tutor comments**, a **topic** tag on each question so strengths and weak areas can be shown, and **progress reports** (a monthly snapshot the parent can download).

**Pillar 5 · Academic Partnership** — **schools** (name, town; added by admin), **teachers** (a person at a school), **consents** (parent + child + school + teacher + subjects + what may be shared + start/end date + signature + withdrawal), **partnership messages** (record of every communication), and a **data access log** (who opened which child's data, when).

**Cross-cutting** — **push subscriptions** for phone notifications (Web Push), a wider **audit log** (today only owner actions are logged, `owner.ts`), and **plans/subscriptions** for paid services when revenue starts (`tutor_profile.plan` already exists, D49).

| New table (proposed)                | Key fields (plain words)                                                                        | Pillar       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- | ------------ |
| `lesson.meeting_url` (new field)    | optional outside meeting link, shown as "Join lesson"                                           | 1            |
| `homework.child_id` (new field)     | which child the homework is for                                                                 | 1            |
| `message`                           | tutor ↔ family note, linked to a lesson or homework, read/unread                                | 1            |
| `study_plan`                        | child, subject, weekdays, minutes, start/end                                                    | 2            |
| `check_in`                          | child, date, subjects studied, how it went (1–3), note                                          | 2            |
| `reminder_pref`                     | person, check-in time, channel (in-app / push / email)                                          | 2            |
| `curriculum_entry`                  | child, subject, syllabus, current topic, textbook, entered by, verified by, date                | 3            |
| `school_test`                       | child, subject, date, what it covers, entered by                                                | 3            |
| `assessment`                        | tutor, subject, level, title, time limit, questions (stored as small JSON)                      | 4            |
| `assessment_assignment`             | assessment, child/student, due date                                                             | 4            |
| `assessment_attempt`                | assignment, answers, started/finished, mark, tutor comment, marked at                           | 4            |
| `topic_tag`                         | free-text topic per question (typed by the tutor)                                               | 4            |
| `progress_report`                   | child, month, summary text, generated at                                                        | 4            |
| `school`                            | name, town, contact, added by admin, status                                                     | 5            |
| `teacher`                           | user, school, subjects, verified by admin                                                       | 5            |
| `partnership_consent`               | parent, child, school, teacher, subjects, scope, signed at, child assent, expires, withdrawn at | 5            |
| `partnership_message`               | consent, from, to, text, attachment, sent at                                                    | 5            |
| `access_log`                        | who, whose data, what page/record, when                                                         | 5 + security |
| `push_subscription`                 | person, browser endpoint, keys, created                                                         | all          |
| `child.student_user_id` (new field) | optional link from a child record to the child's own login                                      | all          |

## 3. Sitemap

Legend: **Exists** = live route today; **Extend** = route exists but needs more; **New** = to build. Status and costs are detailed in `04-feature-map.md`.

### Public

| Page                      | Proposed URL                                                  | Today                                                |
| ------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| Homepage                  | `/`                                                           | Exists (`src/routes/+page.svelte`)                   |
| Find a tutor              | `/tutors`                                                     | Exists (filters subject, level, mode, location; D64) |
| Subject discovery         | `/subjects`, `/subjects/[name]`                               | New (today only a filter on `/tutors`)               |
| Tutor profile             | `/t/[slug]` (+ `/about`, `/subjects`, `/results`, `/reviews`) | Exists                                               |
| How Tutora works          | `/how-it-works`                                               | New (today a short section on the homepage)          |
| For tutors (join)         | `/join`, `/join/signup`                                       | Exists                                               |
| Register (family)         | `/signup`                                                     | Exists (student or parent)                           |
| Login                     | `/login`, `/login/2fa`                                        | Exists                                               |
| Forgot / reset password   | `/forgot-password`, `/reset-password`                         | Exists                                               |
| Contact / help            | `/contact`                                                    | Exists                                               |
| Privacy, Terms            | `/privacy`, `/terms`                                          | Exists (drafts, D78)                                 |
| Academic Partnership info | `/partnership`                                                | New (explains the premium service and consent)       |

### Student (`/student`)

| Page                  | Proposed URL                                        | Today                                            |
| --------------------- | --------------------------------------------------- | ------------------------------------------------ |
| Overview              | `/student`                                          | Exists ("Needs your attention", lessons, tutors) |
| My lessons            | `/student/lessons`                                  | Extend (list is on `/student` today)             |
| Lesson details / join | `/student/lessons/[id]` → `/room/[id]`              | Exists                                           |
| Book a lesson         | `/student/book`                                     | Exists                                           |
| Homework              | `/student/homework`                                 | Exists                                           |
| Assessment centre     | `/student/assessments`, `/student/assessments/[id]` | New                                              |
| My results            | `/student/results`                                  | New                                              |
| My progress           | `/student/progress`                                 | New                                              |
| Study schedule        | `/student/schedule`                                 | New                                              |
| Daily check-ins       | `/student/check-in`                                 | New                                              |
| Notifications         | `/notifications`                                    | Exists (shared by all roles)                     |
| Messages & feedback   | `/student/messages`                                 | New                                              |
| Payments & receipts   | `/student/payments`                                 | Exists                                           |
| Reviews               | `/student/review`                                   | Exists                                           |
| Profile / settings    | `/account` (+ `/password`, `/2fa`, `/export`)       | Exists                                           |

### Parent (`/parent`, new area; today parents use `/student`)

| Page                    | Proposed URL                       | Today                                       |
| ----------------------- | ---------------------------------- | ------------------------------------------- |
| Overview (all children) | `/parent`                          | Extend (from `/student`)                    |
| Children management     | `/parent/children`                 | Exists as `/student/children`               |
| Child dashboard         | `/parent/children/[id]`            | New                                         |
| Subject performance     | `/parent/children/[id]/subjects`   | New                                         |
| Study accountability    | `/parent/children/[id]/study`      | New                                         |
| Homework                | `/parent/children/[id]/homework`   | Extend (from `/student/homework`)           |
| Assessment results      | `/parent/children/[id]/results`    | New                                         |
| Tutor feedback          | `/parent/children/[id]/feedback`   | New (homework feedback exists)              |
| Lesson history          | `/parent/children/[id]/lessons`    | Extend (from `/student`)                    |
| Attendance              | `/parent/children/[id]/attendance` | Extend (data exists: `attendee.attendance`) |
| Book a lesson           | `/parent/book`                     | Exists as `/student/book`                   |
| Payments & receipts     | `/parent/payments`                 | Exists as `/student/payments`               |
| Academic reports        | `/parent/children/[id]/reports`    | New                                         |
| Academic Partnership    | `/parent/partnership`              | New                                         |
| Notifications           | `/notifications`                   | Exists                                      |
| Account                 | `/account`                         | Exists                                      |

### Tutor (`/tutor`)

| Page                           | Proposed URL                                                      | Today                                   |
| ------------------------------ | ----------------------------------------------------------------- | --------------------------------------- |
| Overview ("Today")             | `/tutor`                                                          | Exists                                  |
| Calendar & availability        | `/tutor/calendar`, `/tutor/settings/times`                        | Exists                                  |
| Bookings                       | `/tutor/bookings`                                                 | Extend (requests are on `/tutor` today) |
| Lesson page                    | `/tutor/lessons/[id]`                                             | Exists (notes, attendance, cancel)      |
| Student directory              | `/tutor/students`                                                 | Exists                                  |
| Student profile                | `/tutor/students/[id]`                                            | Exists                                  |
| Learning history               | `/tutor/students/[id]/history`                                    | Extend                                  |
| Assignments / homework         | `/tutor/homework`                                                 | Exists                                  |
| Assessment creation            | `/tutor/assessments`, `/tutor/assessments/new`                    | New                                     |
| Marking                        | `/tutor/marking`                                                  | New (homework "checked" exists)         |
| Feedback & recommendations     | `/tutor/students/[id]/feedback`                                   | New                                     |
| Accountability overview        | `/tutor/accountability`                                           | New                                     |
| Curriculum & textbook info     | `/tutor/students/[id]/curriculum`                                 | New                                     |
| Academic Partnership workspace | `/tutor/partnership`                                              | New                                     |
| Earnings                       | `/tutor/payments` (+ `/export`)                                   | Exists ("Money")                        |
| Reviews                        | `/tutor/reviews`                                                  | Exists                                  |
| Profile / settings             | `/tutor/settings/[section]`, `/tutor/setup/[step]`, `/tutor/more` | Exists                                  |

### Admin (`/owner`)

| Page                            | Proposed URL          | Today                                                           |
| ------------------------------- | --------------------- | --------------------------------------------------------------- |
| Overview                        | `/owner`              | Extend (today it is the tutor list)                             |
| Tutor management & approvals    | `/owner/tutors`       | Exists inside `/owner`                                          |
| Students                        | `/owner/students`     | Exists (students and parents together)                          |
| Parents                         | `/owner/parents`      | New (split from students)                                       |
| Schools                         | `/owner/schools`      | New                                                             |
| Bookings                        | `/owner/bookings`     | Exists                                                          |
| Payment monitoring              | `/owner/payments`     | Exists                                                          |
| Reports & analytics             | `/owner/analytics`    | New (today `/owner/reports` = reported reviews + help requests) |
| Subjects & curriculum           | `/owner/content`      | Extend (subjects list exists; homepage texts too)               |
| Academic Partnership management | `/owner/partnerships` | New                                                             |
| Help requests                   | `/owner/help`         | Exists inside `/owner/reports`                                  |
| Settings                        | `/owner/account`      | Exists                                                          |
| Security & audit logs           | `/owner/audit`        | Extend (owner actions only today)                               |

### Shared and technical routes (keep)

`/room/[id]` (lesson room) and `/room/[id]/signal`, `/notifications`, `/files` (signed file links), `/lessons/[id]/ics` (calendar file), `/student/payments/[id]/receipt` and `/tutor/payments/[id]/receipt` (PDF), `/account/export` (my data), `/api/cron/reminders`, `/setup` (one-time owner setup), `/tutor-status`, `/no-access`, `/verify-email`, `/hero-photo`, `/t/[slug]/photo`, `/tutor/photo`.

New: `/partner/...` (teacher view, consent-limited), `/push/subscribe` (save phone-notification permission).
