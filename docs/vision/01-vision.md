# 01 · Vision: from tutor marketplace to academic support ecosystem

Status: planning draft, 12 November 2026. No code has been changed for this plan.

## Where Tutora is today

Tutora is a low-data, phone-first website where parents and students in Zimbabwe find a tutor, book lessons, pay the tutor directly (EcoCash, InnBucks, bank or cash, with proof uploaded), get receipts, receive homework and join a built-in, low-data online lesson room. Tutors run their whole practice from it (calendar, students, homework, money). The platform owner approves tutors and watches over everything from an admin area. See `04-feature-map.md` for the full audit.

## Where the owner wants it to go

**Positioning line:** _"Good grades are a great start. Let's build on them."_

Tutoring is not only for students who are struggling. It is also for good students who want to stay ahead, prepare early for exams, and build steady study habits. Tutora should feel like a calm, organised partner in a child's education, not an emergency service.

Tutora becomes an **academic support ecosystem**: the place where the student, their parents and their tutors (and, only if the parent agrees, their school) see the same honest picture of how the student is doing and what to do next.

## The five pillars

| #   | Pillar                                                                       | In plain words                                                                                                                                                           | Who benefits most     |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| 1   | **Academic Support**                                                         | Find a good tutor, book, learn (online or in person), get homework and feedback. Mostly built already.                                                                   | Student, parent       |
| 2   | **Study Accountability**                                                     | A simple study schedule, a short daily check-in ("What did you study today? How did it go?"), gentle reminders and a weekly summary for parents.                         | Student, parent       |
| 3   | **Curriculum Alignment**                                                     | Lessons and homework follow what the student is actually doing at school: syllabus (e.g. ZIMSEC or Cambridge), current topic, textbook in use, upcoming tests.           | Tutor, student        |
| 4   | **Performance Monitoring**                                                   | Short assessments set by the tutor, marked results, topic-by-topic strengths and weak areas, and a progress view over time.                                              | Parent, tutor         |
| 5   | **Parent & School Collaboration** — premium: **Tutora Academic Partnership** | With the parent's written consent, a named school teacher can share and receive agreed information (e.g. topic plans, test dates) with the tutor. Voluntary for schools. | Parent, tutor, school |

## The four portals

All four live in the **same website, with one login**. What you see depends on your role.

| Portal      | Who                    | Main job                                                                                                | Today                                                                |
| ----------- | ---------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Student** | Students (often 12–19) | See lessons, do homework and assessments, check in daily, see own progress                              | Exists at `/student` (shared with parents)                           |
| **Parent**  | Parents / guardians    | Manage several children, see each child's progress, pay, read feedback, give consent                    | Partly exists: parents use the student area plus `/student/children` |
| **Tutor**   | Approved tutors        | Teach, set homework and assessments, give feedback, see curriculum info, earn                           | Exists at `/tutor`                                                   |
| **Admin**   | Platform owner (team)  | Approve tutors, watch bookings and payments, manage subjects and curriculum, handle partnerships, audit | Exists at `/owner`                                                   |

## Honesty rules (these apply to every feature)

These rules come from the owner and are non-negotiable. Designs and code must follow them.

1. **Never claim a quiz proves a child studied.** A quiz shows what the child could do on that day. We describe results as _demonstrated understanding_, never as proof of effort or hours.
2. **Measure three honest things only:**
   - **Demonstrated understanding** — marks on assessments and homework the tutor has checked.
   - **Engagement** — attended lessons, homework handed in, check-ins done.
   - **Consistency** — how regularly those things happen over weeks.
     Labels on screens must use these words, not "effort", "hard work" or "hours studied".
3. **Never invent curriculum or textbook data.** Tutora does not ship a made-up syllabus or a textbook list. Curriculum topics and textbooks are **entered by parents, students or tutors**, and marked "verified" only when the tutor or parent confirms them. The admin may keep a list of subject names (already exists) but not invented topic lists.
4. **School participation is voluntary.** No school is ever required to join, and Tutora never says a school "partners" with it unless that school has agreed in writing.
5. **No automatic access to school records.** Tutora never pulls data from school systems. Anything from a school is shared by a named teacher, for a named child, under the parent's signed consent (see `08-schools-consent-privacy.md`).
6. **The live site shows real data only.** No fake tutors, reviews, ratings, results, user counts or testimonials on the live site. Fake data lives only on the separate test site (D55, D59). Empty sections are hidden (D2), and numbers like ratings or lesson counts appear only when real (D62, D82).
7. **Free stays useful.** Finding a tutor, booking, paying the tutor, homework and the lesson room stay free for families. Tutors are not charged just for registering before Tutora brings them customers.
8. **Low data first.** Every new page must work on a cheap phone on slow 3G (the homepage budget is under 150 KB; today it is about 60 KB, D62).

## What success looks like (no invented numbers)

We will not set targets using made-up figures. Instead, once each phase is live, we measure from real data:

- How many families use the study schedule and check-ins week after week (consistency).
- How many assessments tutors set and mark.
- Whether parents open the weekly summary.
- Whether any parent and school choose to start an Academic Partnership.

Targets can be set after the first month of real usage.
