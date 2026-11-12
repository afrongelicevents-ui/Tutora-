# 03 · User journeys

Each journey says what already works (✔ = exists today) and what is new (✚ = to build). URLs follow `02-architecture-and-sitemap.md`.

## 1. Student (e.g. Form 4, doing well, wants to stay ahead)

1. ✔ Finds Tutora, opens **Find a tutor** (`/tutors`), filters by subject and level, reads a tutor profile (`/t/[slug]`).
2. ✔ Signs up (`/signup`). Under 18: must give a parent's name and phone (D7, `profile_minor_needs_parent`).
3. ✔ Books a free 15-minute intro chat or a lesson (`/student/book`). Tutor accepts; student is told in the app (bell).
4. ✚ First time in the area, a short prompt: "Tell your tutor what you're doing at school" → enters syllabus, current topic, textbook (`curriculum_entry`, marked "entered by student").
5. ✚ Sets a **study schedule** (`/student/schedule`): e.g. Maths Mon/Wed/Fri 40 min, at 18:00.
6. ✚ Each evening gets a reminder (in-app, and phone push if allowed) → opens **Daily check-in** (`/student/check-in`): ticks what was studied, picks "Went well / OK / Hard" (words, no emoji, matching the brand), optional note. Takes under 30 seconds, under 20 KB.
7. ✔ Lesson day: 24 h and 1 h reminders. Opens lesson page (`/student/lessons/[id]`) → **Join lesson** → built-in room (`/room/[id]`), or the tutor's outside link if the tutor set one (✚).
8. ✔ After the lesson: homework arrives (`/student/homework`), hands in a photo or PDF, reads feedback.
9. ✚ Tutor sets a short **assessment** → student does it in the **Assessment centre** (`/student/assessments/[id]`), sees mark and tutor comment once marked (`/student/results`).
10. ✚ **My progress** (`/student/progress`) shows, per subject: assessment marks over time (demonstrated understanding), lessons attended and homework handed in (engagement), check-in streak by week (consistency). No "hours studied" claims.
11. ✔ Pays (or parent pays) the tutor directly, uploads proof, downloads receipt (`/student/payments`).

## 2. Parent with several children

1. ✔ Signs up as a parent (`/signup`), adds children (today `/student/children`, ✚ moves to `/parent/children`): name, level, school year.
2. ✚ Optionally links an older child's own student login, so the child can do check-ins and assessments themselves.
3. ✔ Books a lesson and chooses which child it is for (D66). Tutor sees the child's name.
4. ✚ **Parent overview** (`/parent`): one card per child with "needs attention" items (homework overdue, assessment result ready, payment owed, missed check-ins this week).
5. ✚ Taps a child → **Child dashboard** (`/parent/children/[id]`): next lesson, current topic per subject, latest results, attendance, tutor feedback.
6. ✚ **Study accountability** (`/parent/children/[id]/study`): this week's plan vs check-ins done. Wording: "Checked in 4 of 5 planned days". Never "studied 4 hours".
7. ✚ Enters or confirms curriculum info (syllabus, textbook, test dates) — marked "verified by parent".
8. ✔ Pays tutor(s) directly, uploads proof, gets PDF receipts per tutor (`/student/payments`, ✚ `/parent/payments`).
9. ✚ Gets a **monthly academic report** per child (`/parent/children/[id]/reports`), downloadable as a small PDF.
10. ✚ Weekly summary as a notification (in-app/push; email if switched on).
11. ✚ Optionally starts an **Academic Partnership** for one child (journey 5).

## 3. Tutor

1. ✔ Joins at `/join` → signs up (`/join/signup`) → sets up authenticator (2FA required) → setup wizard (`/tutor/setup/[step]`) → **Send for approval**. Owner approves; public page goes live (D65).
2. ✔ **Today** (`/tutor`): today's lessons, requests to accept/decline/propose, payments to confirm.
3. ✔ Calendar with free times, blocked days and personal events (`/tutor/calendar`).
4. ✚ **Before a Maths lesson** the tutor opens the lesson page (`/tutor/lessons/[id]`) and sees a **lesson brief** for each student:
   - **Current topic** (from curriculum entries; shows who entered it and whether verified).
   - **Recent results** (last 3 assessment marks, with topic tags).
   - **Missing homework** (set but not handed in, or handed in and not yet checked).
   - **Previous feedback** (what the tutor wrote last time, plus last lesson's private note — which exists today).
   - **Weak areas** (topics where recent marks are lowest — calculated only from the tutor's own marked questions; shown as "lower marks in: …", not as a diagnosis).
   - Upcoming school test date, if entered.
5. ✔ Teaches in the built-in room (or ✚ opens their saved outside link).
6. ✔ After the lesson marks Completed / Absent and writes a private note (D70).
7. ✔ Sends homework (to several students at once, D74). ✚ Can pick the child, not just the account.
8. ✚ Creates an **assessment** (`/tutor/assessments/new`): short multiple-choice and short-answer questions, each tagged with a topic; assigns it with a due date.
9. ✚ **Marking** (`/tutor/marking`): multiple-choice marks itself; tutor marks short answers and photo answers, adds a comment and a **recommendation** ("Practise factorising: textbook ex. 4B").
10. ✚ **Accountability overview** (`/tutor/accountability`): which students checked in this week (only for families who chose to share this with the tutor).
11. ✔ **Money** (`/tutor/payments`): owed, paid, receipts, monthly totals, CSV.

## 4. Admin (platform owner)

1. ✔ Logs in with 2FA → `/owner`.
2. ✔ Approves or sends back tutors with a reason, suspends, re-activates, adds tutors (D46, D47, D75).
3. ✔ Watches bookings and payments by status; sees "reported but not confirmed after 7 days" (D75).
4. ✔ Hides reported reviews, closes help requests (`/owner/reports`).
5. ✔ Edits homepage texts, hero photo and the standard subjects list (`/owner/content`).
6. ✔ Reads the audit log of admin actions (`/owner/audit`).
7. ✚ Adds **schools** and verifies **teachers** for partnerships (`/owner/schools`, `/owner/partnerships`).
8. ✚ Sees **analytics** from real data only: active tutors, lessons completed, check-in usage, assessment usage (`/owner/analytics`).
9. ✚ Reviews the **data access log** for partnership records; handles withdrawal and breach steps.

## 5. Academic Partnership consent journey

Precondition: the parent has a Tutora account and the child is listed under them. The school has agreed (in writing, outside Tutora) to take part, and the admin has added it.

1. ✚ Parent opens **Academic Partnership** (`/parent/partnership`) → reads a plain explanation of what it is, what it costs (when priced) and that it is optional for everyone.
2. ✚ Chooses: **child** → **school** (from the admin's list) → **teacher(s)** (named, verified by admin) → **subjects** → **what may be shared**, ticked one by one:
   - Topic plan and upcoming tests (school → tutor)
   - Tutor's lesson summaries (tutor → teacher)
   - Assessment results from Tutora (tutor → teacher)
   - Attendance at Tutora lessons
3. ✚ Chooses an **end date** (default end of the school term; maximum 12 months).
4. ✚ If the child is 12 or older (age to be confirmed by a lawyer), the child sees a short, simple **assent** screen on their own login, or the parent ticks "I have explained this to my child and they agree".
5. ✚ Parent **signs** (types full name + ticks + the date/time and IP are stored). A PDF copy is saved and emailed/available to download.
6. ✚ The teacher gets an invitation, logs in with a limited account, and sees **only** that child, those subjects and those items (`/partner/...`).
7. ✚ Every view by anyone of partnership data is written to the **access log**; the parent can see it (`/parent/partnership` → "Who has looked").
8. ✚ All messages between tutor and teacher stay inside Tutora (`partnership_message`) and the parent can read them.
9. ✚ **Withdraw at any time**: one button. Access stops immediately; the teacher and tutor are told; records are kept only as long as the retention policy says.
10. ✚ Before the end date the parent is reminded to renew or let it lapse. If it lapses, access stops automatically.
