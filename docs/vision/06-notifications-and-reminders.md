# 06 · Notifications and reminders

Prices checked by web search on **12 November 2026** — **check before buying**. Source codes (S…) are listed in `10-technical-recommendation.md`.

## What exists today

- **In-app notifications (the bell)** for every role: `notification` table, `/notifications` page, `src/lib/server/notify.ts`. Kinds: booking, lesson, payment, homework, review, account, reminder.
- **Email** for the same events, only when `RESEND_API_KEY` is set (D33, D37). Not switched on yet.
- **Reminders**: 24 h and 1 h before each lesson, and "homework due tomorrow", sent hourly by a free GitHub Actions job (`.github/workflows/reminders.yml` → `scripts/deploy/reminders.ts` → `src/lib/server/reminders.ts`). Each reminder is sent once (claimed in the database first).
- **Preferences**: people can switch off email, reminders and homework messages, but not booking, payment or account messages (`notification_pref`, D72).
- **WhatsApp**: only "open WhatsApp with the message typed" buttons — no paid WhatsApp service (D25).

## Free first

### 1. In-app (exists) — $0

Always on. Every new feature (check-ins, assessments, reports, partnership) uses the same `notifyUser()`.

### 2. Phone notifications via Web Push — $0

**How it works, simply:** the person taps "Turn on phone notifications". The phone asks "Allow?". If they say yes, the browser gives Tutora a private address for that phone. When something happens, Tutora's server sends a tiny encrypted message to that address, and the phone shows it — even when Tutora is closed. The message goes through the browser maker's free push service (Google for Chrome/Android, Apple for iPhone), so there is **no per-message fee**.

What is needed:

- A **service worker** (a small script the browser keeps). Tutora has a web manifest (`static/manifest.webmanifest`) but **no service worker yet**.
- A pair of **VAPID keys** (free, made once, stored as a Cloudflare secret).
- A `push_subscription` table and a `/push/subscribe` route.
- Sending from the Worker: encrypting the message needs standard crypto, available in Workers.

**iPhone rule:** on iOS/iPadOS 16.4 or later, Web Push works **only after the site is added to the Home Screen**, and the permission must be asked after the person taps a button [S13]. So the design needs a short "Add Tutora to your Home Screen" guide for iPhone users. Some sources disagree on whether Chrome/Firefox on iPhone support it — test on real phones.

**Android:** works in Chrome without installing, but installing to the home screen is still recommended.

**Data use:** each push is a few hundred bytes.

## Costed options (only when free channels are not enough)

### Email — Resend

- Free: **3,000 emails a month, 100 a day**. Pro: **$20 a month for 50,000** [S4].
- Needs a domain for good delivery.

### SMS to Zimbabwe numbers (+263)

| Provider                                                                                    | Price per SMS to Zimbabwe                                         | Verified?                                                                                            |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Plivo                                                                                       | Econet **$0.2941**, NetOne **$0.1015**, Telecel **$0.3289** [S15] | Yes, from Plivo's Zimbabwe pricing page (via search)                                                 |
| Twilio                                                                                      | A third-party guide says about $0.20                              | **Price not verified** on Twilio's own page                                                          |
| Africa's Talking                                                                            | —                                                                 | **Price not verified** (not found)                                                                   |
| Local Zimbabwe bulk SMS providers (e.g. via Econet/NetOne bulk services, local aggregators) | One comparison site mentions very low bundle prices               | **Price not verified** — ask local providers for written quotes; usually need sender-ID registration |

Notes: Twilio's guidelines say SMS to Zimbabwe landlines is not supported and two-way SMS is not supported [S14].

### WhatsApp Business Platform (Meta)

- Since 1 July 2025 Meta charges **per message**, by template category [S16].
- **+263 numbers are charged at "Rest of Africa" rates** (Meta's pricing changelog) [S16].
- Rest of Africa rates reported from 1 October 2026: **marketing $0.0225, utility $0.0040, authentication $0.0040** per message [S17]. These come from partner price tables; Meta's own rate sheet was not opened — **check before buying**.
- **Free:** replies inside the 24-hour "customer service window" (opened when the person messages you), and **utility templates sent inside that window** [S16].
- Lesson reminders are **utility** templates (allowed if they are about an existing booking). Promotions such as "Book exam revision" are **marketing** templates (higher price, need opt-in).
- **BSP fees:** using Meta's Cloud API directly has no partner fee; many Business Solution Providers add their own monthly or per-message fee on top. **BSP fees not verified** — compare quotes.
- Needs: a Meta Business account, a phone number for the business, template approval, and opt-in from each person.

## Example monthly cost formula (arithmetic only)

```
monthly cost = number of people × messages per person per month × price per message
```

Example A — lesson reminders: 100 students × 8 reminders a month (2 per lesson × 4 lessons) = **800 messages**.

| Channel                                | Price used                        | 800 messages                           |
| -------------------------------------- | --------------------------------- | -------------------------------------- |
| In-app + Web Push                      | $0                                | **$0**                                 |
| Email (Resend Free)                    | $0 within 3,000/month and 100/day | **$0**                                 |
| WhatsApp utility (outside 24-h window) | $0.0040                           | 800 × 0.0040 = **$3.20** + any BSP fee |
| SMS via Plivo to NetOne                | $0.1015                           | 800 × 0.1015 = **$81.20**              |
| SMS via Plivo to Econet                | $0.2941                           | 800 × 0.2941 = **$235.28**             |

Example B — daily check-in reminders: 100 students × 30 days = **3,000 messages**.

| Channel                 | 3,000 messages                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| In-app + Web Push       | **$0**                                                                                                          |
| Email (Resend Free)     | Uses the whole 3,000/month and exactly the 100/day cap, leaving no room for other emails → would need Pro ($20) |
| WhatsApp utility        | 3,000 × 0.0040 = **$12.00** + any BSP fee                                                                       |
| SMS via Plivo to NetOne | 3,000 × 0.1015 = **$304.50**                                                                                    |
| SMS via Plivo to Econet | 3,000 × 0.2941 = **$882.30**                                                                                    |

**Conclusion:** daily reminders must be free channels (in-app + Web Push). Paid channels only for important, low-volume messages (e.g. a 1-hour lesson reminder by WhatsApp for families who choose it), and possibly only as part of a paid plan.

## Daily check-in reminder design

- **Who:** students with a study schedule (or the parent, for children without their own login).
- **When:** at the time the family chose (default 18:00 Zimbabwe time), only on **planned study days**.
- **Channel order:** in-app always → Web Push if allowed → nothing else by default. Email only if the person turns it on (and email is switched on).
- **Message:** "Time for today's check-in: Maths, 40 min. It takes 30 seconds." One tap opens `/student/check-in`.
- **No nagging:** at most one reminder per day; none if already checked in; a "pause for a week" option (exams, holidays); a quiet time (no messages 21:00–06:00).
- **Parents:** a **weekly** summary (Sunday evening), not a daily alert: "Tatenda checked in on 4 of 5 planned days." No claim about hours studied.
- **How it runs:** the existing hourly GitHub Actions job is too coarse for exact times but fine for "within the hour". Add a `check_in_reminder` step to `sendDueReminders()` that finds people whose reminder hour is now and who have not checked in today. Cost $0.
- **Settings:** in `/account` → Notifications: check-in time, days, on/off, push on/off.
