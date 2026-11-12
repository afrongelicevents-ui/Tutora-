# 05 · Integrations: built-in or outside services?

All prices and limits were checked by web search on **12 November 2026**. They change often — **check before buying**. Where a figure could not be confirmed on the provider's own page, it says so.

## 1. Video lessons

### The "Join lesson" flow (recommended)

Tutora keeps the **built-in room as the default**. A tutor may also save an **outside meeting link** (Google Meet, Teams, Jitsi, Zoom) on a lesson or as their default. On the lesson page the **Join lesson** button then opens:

- the built-in room (`/room/[id]`) if no link is saved, or
- the saved outside link in a new tab/app.

Tutora only **stores the link and opens it**. It does not create meetings in other services at first (no API keys, no outside accounts for Tutora, no extra data stored). Reminders include the same Join button.

### Comparison

|                              | Built-in room (exists)                                                                                  | Google Meet                                                                                                                                         | Microsoft Teams                                                     | Jitsi (meet.jit.si / JaaS)                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Account needed               | Tutora login only                                                                                       | Host needs a Google account; guests can usually join by link                                                                                        | Host needs a Microsoft account                                      | meet.jit.si: login for host; JaaS: developer account                                  |
| Cost to Tutora               | $0 (direct phone-to-phone; optional Cloudflare TURN relay: 1,000 GB/month free, then $0.05 per GB [S5]) | $0 for link-only                                                                                                                                    | $0 for link-only                                                    | JaaS free up to 25 monthly active users; paid tiers listed from $99 (300 users) [S10] |
| Time limits on free accounts | None (room open 10 min before to 2 h after, D71)                                                        | Group calls (3+ people) end at 60 min on a free host account; one-to-one up to 24 h [S8]                                                            | Group meetings 60 min on Teams Free; two-person calls no limit [S9] | One report of a 95-minute limit on meet.jit.si — not confirmed officially [S10]       |
| Create links by API          | n/a                                                                                                     | Meet REST API has `spaces.create` (needs OAuth scope `meetings.space.created`); whether a free personal account is enough was **not verified** [S7] | Microsoft Graph `onlineMeeting`; licence needs **not verified**     | JaaS iFrame API; embedding meet.jit.si itself is no longer allowed [S10]              |
| Data use                     | **Lowest**: audio about 24 kbps by default (about 11–20 MB per hour), video optional at 360p (D21)      | Higher; video by default                                                                                                                            | Higher; video by default                                            | Medium; video by default                                                              |
| Zimbabwe fit                 | Best for low data; works without outside accounts; may fail on some networks without TURN (D22)         | Familiar to many; good if family already uses it                                                                                                    | Common in some private schools                                      | Fine, but free hosted version is restricted                                           |

**Recommendation:** keep the built-in room as default (lowest data, no outside account, chat not stored). Add the **outside link field** in Phase 2 (tiny job, $0). Do **not** build Meet/Teams API integration until tutors ask for it, because it adds Google/Microsoft app verification work and stores tokens. Switch on Cloudflare TURN (free tier) before launch so calls connect on strict mobile networks.

## 2. File storage

|              | Database (today)                                                        | Cloudflare R2                                                                                                    | Google Drive                                                         |
| ------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| How it works | Files saved in `file_blob` table (D39)                                  | Private bucket, signed 10-minute links (code ready: `R2Store` in `files.ts`, used when a `FILES` binding exists) | Each user or Tutora stores files in Drive                            |
| Free amount  | Shares Neon's 0.5 GB per project (one Neon page says 1 GB — check) [S3] | 10 GB-month storage, 1 million writes, 10 million reads, free downloads [S2]                                     | Not verified in this check                                           |
| Paid price   | Neon Launch storage $0.35 per GB-month [S3]                             | $0.015 per GB-month; $4.50 per million writes; $0.36 per million reads [S2]                                      | Not verified                                                         |
| Card needed  | No                                                                      | Cloudflare asks for a payment method to enable R2 (stated in D39; not re-checked)                                | No (personal)                                                        |
| Privacy fit  | Good                                                                    | Good (private, signed links)                                                                                     | Weak: sharing permissions are easy to get wrong for children's files |

**Recommendation:** stay on the database now; **move to R2 when the database reaches about 0.3 GB** (watch in Neon). The switch is a binding in `wrangler.jsonc`, plus a one-off copy script for old files. Do not use Google Drive for children's files.

## 3. Calendars

|      | `.ics` download (exists)                                  | Google Calendar API                                                                                                                                                    |
| ---- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How  | `/lessons/[id]/ics` adds one lesson to any phone calendar | Tutora writes events into a tutor's Google Calendar                                                                                                                    |
| Cost | $0                                                        | Google says Calendar API use has no extra cost within quotas, but another Google page says over-quota charges are planned later in 2026 — **conflicting, check** [S11] |
| Work | None                                                      | Google sign-in, OAuth consent screen and app verification; token storage                                                                                               |
| Fit  | Works for everyone, no account                            | Only for Google users                                                                                                                                                  |

**Recommendation:** keep `.ics`. Next cheap step: a **private calendar feed link** per tutor (one `.ics` URL that phones subscribe to and refresh). Defer Google Calendar API.

## 4. Assessments

|                        | Own (Tutora)                                 | Kahoot                                                                                                       | Google Forms                                     |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Results stay in Tutora | Yes (needed for progress and parent reports) | No                                                                                                           | No (in the tutor's Google account)               |
| Cost                   | $0 (text rows)                               | Free plan participant cap reported as 10 or 40 — sources disagree; paid teacher price **not verified** [S12] | Free with a Google account (limits not verified) |
| Data use               | Very low (text form)                         | High (live game, images, music)                                                                              | Medium                                           |
| Children's data        | Under Tutora's privacy rules                 | Third party                                                                                                  | Third party                                      |

**Recommendation:** build **simple own assessments** (multiple choice, short answer, photo of working). Tutors can still paste a Kahoot or Forms link into homework, but those marks will not count in progress views unless the tutor types them in.

## 5. Email

|       | Resend (code ready)                                                                         | Alternatives                                                                               |
| ----- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Free  | 3,000 emails a month, 100 a day [S4]                                                        | Brevo is named as a fallback in `docs/PLAN.md`; its current free tier was **not verified** |
| Paid  | Pro $20 a month for 50,000 emails [S4]                                                      | not verified                                                                               |
| Setup | Add `RESEND_API_KEY` and `EMAIL_FROM` in Cloudflare (D37); needs a domain for good delivery | —                                                                                          |

**Recommendation:** switch on Resend once `tutora.co.zw` (or another domain) is bought. Keep emails plain text (as now). Watch the **100-a-day** cap: daily check-in reminders by email would hit it at about 100 families, so check-in reminders should go by in-app/Web Push first.

## 6. Payments

Covered in `07-revenue.md` (Paynow and alternatives).

## Sources (checked 12 Nov 2026)

See the full list in `10-technical-recommendation.md` → Sources. Codes used here: S2 R2, S3 Neon, S4 Resend, S5 Cloudflare TURN, S7 Google Meet API, S8 Google Meet limits, S9 Teams limits, S10 Jitsi/JaaS, S11 Google Calendar API, S12 Kahoot.
