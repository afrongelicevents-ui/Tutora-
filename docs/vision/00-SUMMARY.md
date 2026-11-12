# Tutora vision: one-page summary

_12 Nov 2026. Plan only: nothing new is built until you approve._

**The idea.** Tutora grows from "find a tutor" into a partner for the whole family: lessons, study habits, schoolwork, progress and (optionally) the school. The message is "Good grades are a great start. Let's build on them." It is for every child, not only children who are struggling.

**What we keep.** Most of it already works:

- tutor search and tutor pages;
- one login for everyone;
- bookings, calendar, homework and receipts;
- notifications, the low-data lesson room and owner admin.

We extend these rather than rebuild them. The brand stays cream, forest green, mint and ochre, with the original logo. We add one calm navy (#1F3A5F) for charts, links and information messages. Every pairing passes the accessibility check (AA).

**The four portals** (planned pages; designs will follow the direction you choose):

- **Student:** one clear next step: the next lesson, today's plan and a 5-minute daily check-in.
- **Parent (new home):** a child switcher, plus six plain answers: attending? completing work? learning what? struggling with? improving? what next?
- **Tutor:** a workspace with a lesson brief before every lesson (topic, recent results, missing homework, last feedback, weak areas). Also quizzes and a marking queue.
- **Admin:** tables, approvals, help, schools, consent records and an audit log, so you never need to open the database.

**What it will cost to run.** Almost everything fits the free tiers we use now: Cloudflare, Neon, in-app messages and phone (push) notifications.

- **Costs start** if:
  - we send a lot of email (free up to 3,000 a month, then $20 a month);
  - files outgrow the database (Cloudflare R2: 10 GB free, then $0.015 per GB);
  - lessons get very busy (Cloudflare's $5 a month plan).
- **SMS is expensive** (about $0.10–$0.33 per message to Zimbabwe), so we don't recommend it for daily reminders.
- **WhatsApp is cheap** for reminders (about $0.004 per message) but needs a business setup.

**Reminders.** Reminders start free: in the app and as phone notifications. Paid channels stay off until you switch them on with a monthly cap.

**Making money** (no prices set; we test them first):

1. Parents pay Tutora directly for Tutora's own extras: the accountability plan, monthly reports and the Academic Partnership.
2. Later, tutors pay a monthly commission statement, only on lessons Tutora brought them. Nobody pays just to register.
3. Only with legal advice: Tutora collects all payments through Paynow and pays tutors out.

**Schools and privacy.** Schools take part only if they choose to. A parent signs written consent that names:

- which school, teacher and subjects;
- an end date, and that they can withdraw at any time.

Older children agree too. Every view and message is logged, and parents can see the log. Tutora never gets school records automatically.

Under Zimbabwe's Cyber and Data Protection Act, Tutora probably already needs a POTRAZ licence and a named Data Protection Officer. Data stored abroad needs a check by a local lawyer.

**Order of work.**

1. Design (now).
2. Improve the existing portals, including a real parent home.
3. Study plans and check-ins.
4. School, curriculum and textbook details.
5. Assessments and reports.
6. Academic Partnership.
7. Optional integrations: Meet or Teams links, and Kahoot.

**Problems found in the current product (to fix in step 2):**

- Homework isn't linked to a specific child.
- Children are stored in two different ways.
- The lesson room checks the server so often that busy days could use up the free hosting limit.
- An old plan document doesn't match the code.

**Full documents** (in `docs/vision/`):

- 01 vision
- 02 architecture and sitemap
- 03 user journeys
- 04 feature map (Exists / Extend / New + monthly cost)
- 05 integrations
- 06 reminders and their costs
- 07 revenue
- 08 schools, consent and privacy
- 09 roadmap
- 10 technical recommendation
- `directions/` (three design directions to choose from: open `index.html`; the full page designs come after you choose)

Every price has its source and the date it was checked. Prices we couldn't confirm say "not verified".
