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
