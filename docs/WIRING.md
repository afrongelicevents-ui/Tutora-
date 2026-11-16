# Tutora wiring audit

How every page connects: what each button, form, number and link should do, whether it really
does it, and the fix. Audited 2026-11-13 by reading every route for every role (student,
under-13 student, parent, tutor, owner, public), then fixed and re-tested with end-to-end flows
(e2e/) and a browser walkthrough.

Everything **not listed** was checked and works: forms post to real actions that write the
database, numbers come from real queries, links and #anchors exist, and data survives a reload
and a second device. No sample or placeholder data is shown on any page.

Status: **works** · **broken** (doesn't do what it says) · **fake** (looks like it does something
it doesn't) · **not connected** (saves, but the other side never hears about it).
The last column says what happened after the fix.

## Student

| ID  | Page → element                                   | Should do                    | Status                                 | Fix                                                        | Now             |
| --- | ------------------------------------------------ | ---------------------------- | -------------------------------------- | ---------------------------------------------------------- | --------------- |
| S1  | Find a tutor → Show more                         | Load 10 more tutors          | broken (`n` removed from the link)     | keep `n` in `withParam`                                    | fixed           |
| S2  | Book → summary box                               | Show choice, time, price     | fake without JS                        | load the page's script (csr)                               | fixed           |
| S3  | Study → focus countdown                          | Count down                   | fake without JS (frozen)               | load the page's script                                     | fixed           |
| S4  | Lessons → Withdraw request                       | Cancel and tell the tutor    | not connected                          | notify tutor (and family)                                  | fixed           |
| S5  | Lessons → Lesson materials "View all"            | All shared lesson files      | broken (pointed to revision resources) | list lesson materials on the homework page                 | fixed           |
| S6  | Lessons → declined request "Choose another time" | Rebook same tutor            | partly (went to Find)                  | link to /student/book?tutor=…                              | fixed           |
| S7  | Buddy → encouragement                            | Buddy is told                | not connected                          | notify buddy (rate-limited)                                | fixed           |
| S8  | Quiz → Submit                                    | Tutor is told                | not connected                          | notify tutor                                               | fixed           |
| S9  | Review → Post                                    | Tutor is told; back link     | not connected                          | notify tutor; back link                                    | fixed           |
| S10 | You → school / grade line                        | Show what Edit profile saved | not connected                          | fall back to the profile card's school/grade               | fixed           |
| S11 | You → daily schedule links                       | Open where blocks are edited | partly                                 | "View schedule" → planner (tick), "Plan my day" → schedule | fixed           |
| S12 | Homework → Hand in again error                   | Show the error               | broken (hidden in closed section)      | keep the section open on error                             | fixed           |
| S13 | Homework → due pill                              | Harare date                  | minor bug (UTC)                        | use local date                                             | fixed           |
| S14 | Home → homework count                            | Count open homework          | partly (skips no-due-date)             | include homework without a due date                        | fixed           |
| S15 | Tools → Kahoot! "on"                             | Real connection              | fake (only a label)                    | honest wording: a preference, no account needed            | fixed           |
| S16 | Phone menu → Payments                            | Reachable on a phone         | missing                                | Payments link on Lessons; empty state when no tutor        | fixed           |
| S17 | Bell after reading a message                     | Count clears                 | stale                                  | reading a thread marks its message notifications read      | fixed           |
| S18 | Family → share / cancel code / remove            | Confirm it worked            | no feedback                            | show notices                                               | fixed           |
| S19 | Personal report → Older days                     | Page back                    | partly                                 | real "more" flag                                           | fixed           |
| S20 | Personal report → Share Yes                      | Family is told               | not connected                          | notify family                                              | fixed           |
| S21 | Under-13 → payments                              | Guardian pays                | not checked                            | managed children see "your parent pays"                    | decision (D123) |
| S22 | Under-13 → delete account                        | Guardian decides             | not checked                            | managed children can't delete; parent can                  | fixed           |

## Parent

| ID  | Page → element                            | Should do                                              | Status                                 | Fix                                                        | Now   |
| --- | ----------------------------------------- | ------------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------- | ----- |
| P1  | Family code → Create account              | Show sign-up                                           | broken (button needs JS)               | plain link                                                 | fixed |
| P2  | Family code → message to the child        | "waiting for guardian" when pending                    | wrong text                             | send the pending message                                   | fixed |
| P3  | Family code → sign-up then connect fails  | Show error                                             | broken (silent)                        | show the error                                             | fixed |
| P4  | Children → approve/decline another parent | Tell the waiting parent                                | not connected                          | notify them (and the child)                                | fixed |
| P5  | Children → Stop following                 | Confirm first; guardian of a managed child can't leave | broken (one click)                     | two-step confirm; block guardian of managed child          | fixed |
| P6  | Children → Book for                       | Any guardian                                           | partly                                 | show for every guardian link                               | fixed |
| P7  | Book for a child                          | Child and co-parents told                              | not connected                          | notify child + other parents                               | fixed |
| P8  | Book → summary                            | Choice/price                                           | fake without JS                        | load script (shared with S2)                               | fixed |
| P9  | Nav → Payments                            | Open a child's payments                                | broken (used the parent's own account) | pick the child                                             | fixed |
| P10 | Payment confirmed/rejected                | Guardian told, receipt                                 | not connected                          | notify guardian parents                                    | fixed |
| P11 | Tutor's "new payment" note                | Show who paid                                          | partly                                 | "X (paid by parent)"                                       | fixed |
| P12 | Updates → Homework toggle                 | Turn homework alerts on/off                            | fake (none sent)                       | send homework set/marked notes to parents who see homework | fixed |
| P13 | Weekly report → planned sessions          | That week's plan                                       | fake for past weeks                    | count only slots that existed that week                    | fixed |
| P14 | Weekly report → check-ins                 | All shared that week                                   | broken for older weeks                 | bound the query to the week                                | fixed |
| P15 | School+ → child chooser                   | Switch child                                           | broken (needs JS)                      | ?child= links                                              | fixed |
| P16 | School+ → Stop confirm                    | Confirm                                                | broken (one click)                     | two-step confirm; empty log state                          | fixed |
| P17 | Messages → who can read                   | Guardian only                                          | privacy                                | guardian links only                                        | fixed |
| P18 | Messages → adult child                    | Explain                                                | missing state                          | "not for 18+" message; hide link                           | fixed |
| P19 | Buddies → approve/decline                 | Guardian only; decline told                            | privacy + not connected                | guardian only; notify on decline                           | fixed |
| P20 | Personal report → child switcher          | Switch child                                           | missing                                | add switcher                                               | fixed |

## Tutor

| ID  | Page → element                   | Should do                        | Status                                 | Fix                                                                                                               | Now             |
| --- | -------------------------------- | -------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------- |
| T1  | Resources → Add                  | Save resource                    | broken (needs JS, fields outside form) | load script                                                                                                       | fixed           |
| T2  | Resources → added                | Students told                    | not connected                          | notify students                                                                                                   | fixed           |
| T3  | Lesson → Attach from Drive       | Picker                           | broken (needs JS)                      | load script (honest "needs Google" without keys)                                                                  | fixed           |
| T4  | Lesson → Cancel                  | Student + family told, with link | partly                                 | link, kind, parents                                                                                               | fixed           |
| T5  | Lesson → material added          | Student told                     | not connected                          | notify students                                                                                                   | fixed           |
| T6  | Student page → Homework feedback | Mark checked + tell student      | broken (stays "to check")              | use markAnswer + notify                                                                                           | fixed           |
| T7  | Student page → Give homework     | Student told with link           | partly                                 | kind homework + link                                                                                              | fixed           |
| T8  | Student page → Record cash       | Receipt link                     | partly                                 | link                                                                                                              | fixed           |
| T9  | Marking → Check                  | Student told                     | not connected                          | notify student (+ parents who see homework)                                                                       | fixed           |
| T10 | Mark absent                      | Charge rule clear; family told   | not connected                          | say "absent lessons are still charged"; tell family                                                               | fixed           |
| T11 | Accept after time off / past     | Refuse                           | partly                                 | check blocked times and the past                                                                                  | fixed           |
| T12 | Student accepts proposed time    | Meeting link + family told       | not connected                          | run after-accept                                                                                                  | fixed           |
| T13 | Confirm/reject payment           | Payer (parent) told              | partly                                 | notify guardians (= P10)                                                                                          | fixed           |
| T14 | Today → Join                     | Only when the room is open       | broken before window                   | show Join from 10 min before                                                                                      | fixed           |
| T15 | Room → "not open" text           | Accurate                         | fake text (30 min)                     | real time, translated                                                                                             | fixed           |
| T16 | Schedule → pending request       | Go to it                         | weak                                   | /tutor#requests                                                                                                   | fixed           |
| T17 | Earnings → lessons / average     | Taught lessons                   | misleading (counts no-shows)           | exclude absent                                                                                                    | fixed           |
| T18 | School+ → accept/decline         | Parent told                      | not connected                          | notify parent                                                                                                     | fixed           |
| T19 | Messages → notification kind     | Own kind                         | wrong kind                             | "message" kind                                                                                                    | fixed           |
| T20 | Student page → topic scores      | Decide scope                     | question                               | keep all the student's marks (the tutor needs the full picture), other tutors' feedback stays hidden — documented | decision (D123) |

## Owner, public, account, notifications

| ID  | Page → element                            | Should do            | Status                      | Fix                                  | Now   |
| --- | ----------------------------------------- | -------------------- | --------------------------- | ------------------------------------ | ----- |
| O1  | Homepage text from Content                | Show owner's text    | not connected               | use it on / and /join                | fixed |
| O2  | Content → photo upload                    | Shrink and upload    | broken (needs JS)           | load script                          | fixed |
| O3  | Owner → "Make active" on draft/rejected   | Only suspended       | broken (skips review)       | only for suspended; server guard     | fixed |
| O4  | Owner → Add tutor                         | Appear when ready    | broken (empty card in Find) | Find shows only tutors with subjects | fixed |
| O5  | Tutor approved email                      | Clickable link       | broken                      | absolute link                        | fixed |
| O6  | Moderation actions                        | Two-step owners only | security                    | requireOwner                         | fixed |
| O7  | Reset test site                           | Audit log            | not connected               | audit                                | fixed |
| O8  | Owner account changes                     | Audit log            | not connected               | audit                                | fixed |
| O9  | Payments → "stale"                        | —                    | dead code                   | remove; translate method             | fixed |
| O10 | Content → subjects empty                  | Empty state          | missing                     | add                                  | fixed |
| O11 | Homework due tomorrow                     | Student reminded     | not connected (never run)   | run it hourly                        | fixed |
| O12 | Sign-up from a tutor's page with email on | Back to booking      | broken                      | keep next through verify             | fixed |
| O13 | Bell on /notifications                    | Clears at once       | stale                       | count after marking; mark only shown | fixed |
| N1  | Homework marked                           | Student (+family)    | none                        | notify                               | fixed |
| N2  | Review posted / replied / hidden          | Tutor / reviewer     | none                        | notify                               | fixed |
| N3  | Request withdrawn                         | Tutor                | none                        | notify (= S4)                        | fixed |
| N4  | Parent's booking declined/proposed        | Parent               | none                        | notify                               | fixed |
| N5  | Tutor cancels                             | Family               | none                        | notify (= T4)                        | fixed |
| N6  | Family link approved/declined/removed     | Other side           | none                        | notify (= P4, P5)                    | fixed |
| N7  | Photo / bio checked                       | Student              | none                        | notify                               | fixed |
| N8  | Tutor suspended                           | Tutor                | none                        | notify                               | fixed |
| N9  | Account restored                          | That person          | none                        | notify                               | fixed |
| N10 | Buddy encouragement                       | Buddy                | none                        | notify (= S7)                        | fixed |
| N11 | Support request closed                    | Requester            | none                        | notify                               | fixed |

## Tutora Pro (tutors, $5/month) — 2026-11-16

| ID   | Page → element                                     | Should do                                                    | Backend                                                            | Now   |
| ---- | -------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ | ----- |
| PR1  | Tutor → More → Tutora Pro (`/tutor/pro`)           | Free vs Pro, price, period, trial, Pro settings              | `proLoad` / `proActions` (pro-pages.ts)                            | wired |
| PR2  | Pro → Pay for Pro                                  | Invoice → checkout with Tutora's details (or "coming soon")  | `createProInvoice`                                                 | wired |
| PR3  | Checkout → proof upload                            | Proof stored, owner told (link to Payments → Tutora Pro)     | `submitProProof` + storage + `notifyOwners`                        | wired |
| PR4  | `/tutor/pro/billing`                               | Due / proof sent / paid / overdue with Pay, Upload, Receipt  | `proBilling`; receipt PDF `proReceiptData` (P-000001)              | wired |
| PR5  | Owner → Money → Payments → Tutora Pro tab          | Confirm (receipt, tutor told) / reject with reason           | `ownerProLoad`, `confirmProInvoice`, `rejectProInvoice`            | wired |
| PR6  | Owner → Settings → Tutora Pro                      | Pro pilot switch (default on), trial days                    | `saveProSettings` (Family settings untouched)                      | wired |
| PR7  | Owner → Settings → Free plans for chosen people    | Search, give Pro/Family free (end date), remove with tick    | plan-gifts.ts (`giveGift`, `removeGift`); read by both accesses    | wired |
| PR8  | Owner → Overview                                   | Pro tutors, Pro money in "this month", Pro proofs to check   | `ownerProStats`                                                    | wired |
| PR9  | Hourly job                                         | Next Pro invoice, 3 reminders (once each), 7 days → Free     | `runProBilling` (scheduled.ts)                                     | wired |
| PR10 | Hourly job (Pro, opt-in)                           | Unpaid lessons > 3 days: student + parents reminded weekly   | `runTutorPayReminders` (claimed per student, `tutor_pay_reminder`) | wired |
| PR11 | Earnings → Earnings reports                        | Income per student (period), per month/year; PDF + CSV       | `incomeByStudent`, `/tutor/payments/report`, `/export` (Pro)       | wired |
| PR12 | Earnings → By student → Send invoice / Invoice PDF | Student and parents told what is owed; PDF of unpaid lessons | `sendTutorInvoice`, `/tutor/students/[id]/invoice`                 | wired |
| PR13 | `/tutor/insights`                                  | Falling behind (missed, homework, scores), missed weekday    | `studentInsights` (last 8 weeks)                                   | wired |
| PR14 | Group lesson → Class tools (`/tutor/class/[id]`)   | Message all, homework for all, mark all present, class link  | `sendMessage` per student, homework `?/send`, `setAttendance`      | wired |
| PR15 | Branded reports                                    | Tutor name + colour on report PDFs when Pro                  | `tutorBrand(db, tutorId)` (null without Pro)                       | wired |
| PR16 | Any Pro feature on the Free plan                   | "Pro" pill + Upgrade, never an error                         | `ProLocked` → `/tutor/pro?locked=…`; export redirects there        | wired |

## Simpler lessons, homework, reports and tools — 2026-11-16

| ID   | Page → element                                      | Should do                                                              | Backend                                                             | Now   |
| ---- | --------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- | ----- |
| SL1  | Lesson pages, Today, calendar, student home → Join  | Tutor's Teams/Meet/Zoom link; "join as a guest" note; no Tutora room   | `joinLinks`; `videoRoom` (layout data, flags.ts)                    | wired |
| SL2  | Lesson with no link yet                             | Student: "hasn't added the link yet"; tutor: "Add the link" button     | `noLink` (student-home), lesson page                                | wired |
| SL3  | Owner → Settings → Tutora video room (old)          | Off by default; turning on brings the old room back                    | `setFlag('video_room')` in `site_content`, audit log                | wired |
| SL4  | `/room/[id]` while off                              | Own lesson → back to the lesson (tutor: note); others 404; signals 404 | `videoRoomOn` in the room page, file action and signal endpoint     | wired |
| SL5  | Marking → Set homework                              | Due date + due time (Zimbabwe time)                                    | `giveHomework` (`due_time`)                                         | wired |
| SL6  | Student → Homework → Hand in (photo or file)        | Late after the due time; tutor and family told at once                 | `handIn`, `handedInLate`, `homeworkHandedIn` (events.ts)            | wired |
| SL7  | Marking → mark done / late / missing                | Late suggested; tutor can change; student + family told                | `markAnswer({ mark })`, `setHomeworkMark`, `tellHomeworkMark`       | wired |
| SL8  | Hourly job                                          | Nothing handed in 24 h after due → missing (once), family told         | `markMissingHomework` (scheduled.ts)                                | wired |
| SL9  | Parent → child → Homework                           | Waiting / handed in (late) / done / late / missing, due time           | child page load                                                     | wired |
| SL10 | Tutor → More → Reports (`/tutor/reports`)           | Pick student + dates, figures filled in, note, save, send, delete      | reports.ts (`createReport`, `updateReport`, `sendReport`)           | wired |
| SL11 | Tutor → report → PDF / Parent → child → Reports PDF | One-page PDF (Pro: tutor's name and colour)                            | `reportPdf`, `reportResponse`; parent only with "progress" shared   | wired |
| SL12 | Connected tools (tutor, student), Lessons tab tiles | Shortcuts that open Teams/Meet/Zoom/Drive/Kahoot!; no sync, no keys    | tool-shortcuts.ts; OAuth, Drive picker, Meet/Teams API code removed | wired |
| SL13 | `/student/help`, `/parent/help`, `/tutor/help`      | "How Tutora works" in simple words                                     | HowItWorks.svelte; linked from Account, parent Settings, tutor More | wired |

## Question bank, tests and the AI test maker (D127)

| ID   | Page → element                                         | Should do                                                                  | Backend                                                          | Now   |
| ---- | ------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----- |
| TB1  | Tutor → Quizzes & tests (`/tutor/assessments`) cards   | Question bank, Build a test, Marking (count), AI test maker (Pro pill)     | `countBank`, `toMarkCount`, `proAccess`                          | wired |
| TB2  | `/tutor/bank` → Add a question (4 kinds)               | Saved with tags; private unless "Share" ticked; original-only note         | `addBankQuestion` (`cleanBankQuestion`, `cleanTemplate`)         | wired |
| TB3  | `/tutor/bank` filters, paging, Share / Stop / Remove   | Own questions only; remove needs the tick                                  | `listBank`, `countBank`, `setShared`, `removeBankQuestion`       | wired |
| TB4  | `/tutor/bank?view=shared` → Copy to my bank            | Others' shared, not hidden; copied once, private                           | `sharedBank`, `copyShared`                                       | wired |
| TB5  | `/tutor/bank/[id]` → Save / "Checked, use it"          | Edit; drafts become ready; maths shows two students' versions              | `updateBankQuestion(approve)`, `instantiate`                     | wired |
| TB6  | `/tutor/tests/new` → Build the test                    | Random pick by subject/form/chapters/difficulty mix; timer; give to pupils | `buildTest`, `pickQuestions`, `assignSet`, notify                | wired |
| TB7  | `/tutor/assessments/[id]` (built test)                 | Picked questions; who has it; Mark now / score / Late                      | `getSet` → `builtQuestions`; `assignmentsForSet` + attempt       | wired |
| TB8  | `/student/quiz/[id]` (built test)                      | Own order + numbers; clock; hand in once; late after the limit             | `openAttempt`, `submitAttempt` (`?/test`), tutor notified        | wired |
| TB9  | `/tutor/marking`, `/tutor/marking/[id]`                | Written answers to mark; change any mark; student told when marked         | `closeExpired`, `markingList`, `saveMarks` → results per chapter | wired |
| TB10 | Quizzes & tests → Enter a score (Google Forms/Kahoot!) | Own students only; into progress with chapter and term                     | `enterOutsideScore`                                              | wired |
| TB11 | Parent → Progress → Test scores this year              | Per term and per chapter (only when the child shares progress)             | `testScoresFor`                                                  | wired |
| TB12 | `/tutor/ai` (Pro)                                      | Notes → drafts in the bank; resting message at the line; Free: Upgrade     | `makeDrafts` (`reserveNeurons`, `settleNeurons`, `parseDrafts`)  | wired |
| TB13 | Owner → Safety → Checks → Questions in the Tutora bank | Hide / show a shared question (logged)                                     | `ownerSharedQuestions`, `ownerHideShared`, `audit`               | wired |
| TB14 | Owner → Free limits → AI test maker today              | Live count vs this site's stop line; hourly reading with the 70% alert     | `aiToday`; `scripts/deploy/usage.ts` → `Usage.ai` → `meters`     | wired |

## Tutora Family, paying Tutora, meeting links, owner admin, login (D125, D128) — 2026-11-16

| ID   | Page → element                                        | Should do                                                                    | Backend                                                                      | Now   |
| ---- | ----------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----- |
| FB1  | Parent home → plan card / child card "Free level"     | Pay now / Upgrade to Tutora Family                                           | `familyHomeStrip`                                                            | wired |
| FB2  | `/parent/plans`                                       | Prices per child, what's included, the wording, trial                        | `familyBilling`, `startTrial`                                                | wired |
| FB3  | `/parent/checkout`                                    | Children + period → total; Tutora's details or "coming soon"; proof upload   | `createCheckoutInvoice`, `submitProof`                                       | wired |
| FB4  | `/parent/billing` + receipt PDF                       | Due / proof sent / paid / overdue with Pay, Upload proof, View receipt       | `familyBilling`, `tutoraReceiptData`                                         | wired |
| FB5  | Any Family page while on the free level               | "Family" label + Upgrade (parent) or "Ask your parent" (child), never broken | hooks.server.ts (`familyAccess`, family-features.ts)                         | wired |
| FB6  | Owner → Money → Payments → Tutora Family              | Confirm (receipt T-…) / reject with a reason; parent told                    | `ownerFamilyActions` (`confirmInvoice`, `rejectInvoice`)                     | wired |
| FB7  | Owner → Settings → Tutora payment details             | EcoCash / InnBucks / bank, discounts, pilot switch, trial days               | `saveTutoraSettings`                                                         | wired |
| FB8  | Hourly job                                            | Next invoice, reminders −3/0/+3 days, grace, free level after 7 days         | `runFamilyBilling` (scheduled.ts)                                            | wired |
| FB9  | Family code connect / create child                    | "I am this child's parent or guardian" required; one paying parent per child | `redeemInvite`, `createChildAccount`, `coveredElsewhere`                     | wired |
| FB10 | Owner → Overview                                      | Family and Pro figures; 4+ children accounts; proofs waiting                 | `ownerFamilyStats`, `manyChildrenAccounts`, `ownerProStats`                  | wired |
| ML1  | Tutor → student page → Lesson link                    | Teams/Meet/Zoom link checked; same-link warning; waiting-room tip            | meeting-links.ts (`checkMeetingLink`, `saveStudentLink` + same-link warning) | wired |
| ML2  | Tutor → group lesson → Class link                     | One link for the class                                                       | `saveLessonLink`                                                             | wired |
| ML3  | Lessons (child, tutor) → Join lesson                  | From 10 minutes before; parent sees "Lesson happened"                        | `joinLinks`, parent child page lessons                                       | wired |
| PT1  | Every lesson / booking page → Pay tutor               | Payments page with the child and tutor chosen → proof → tutor confirms       | PaymentsPage, billing.ts                                                     | wired |
| OA1  | Owner admin (8 sections, phone tabs, desktop sidebar) | Lists with search, filters, pills, paging, "Are you sure?"                   | owner-admin.ts                                                               | wired |
| OA2  | Owner → Content → Photos                              | Replace (WebP < 60 KB, credit, rights tick), back to standard                | photos.ts (`photo_slot`)                                                     | wired |
| LG1  | Login → wrong password 10 times                       | Account locked 30 minutes; the person is told; right password clears         | rate-limit.ts (`loginFail`, `peekLimit`, `clearLimit`)                       | wired |
