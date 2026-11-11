# Tutora — Plan (for approval)

Status: **All 7 phases built (11 Nov 2026).** Not deployed yet; see `docs/DEPLOY.md`. Choices made overnight are listed in `docs/DECISIONS.md`.

Figma (brand board + 390px home mock): https://www.figma.com/design/DxxUgk80UR8qcOo21dYc0m
Screenshots: `docs/design/brand-board.png`, `docs/design/home-mobile.png`

---

## 1. Hosting and stack (cost ≈ $0/month)

| Need                                        | Choice                                               | Free tier (check again at sign-up)         | Why                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Code                                        | Private GitHub repo (this one)                       | Free                                       | Already in use                                                                                                   |
| Web app + API                               | **Cloudflare Workers** (static assets + server code) | 100k requests/day                          | Commercial use allowed on the free plan, unlike Vercel Hobby. Has a data centre in Johannesburg, close to users. |
| Database                                    | **Neon Postgres**                                    | 0.5 GB, scales to zero                     | Real Postgres without Supabase. Tutora's data is tiny (text rows).                                               |
| Files (payment proof, homework, chat files) | **Cloudflare R2**, private bucket, signed URLs       | 10 GB, no download fees                    | Private by default, cheap                                                                                        |
| Call signalling + lesson room state         | **Cloudflare Durable Objects** (WebSockets)          | Included in Workers free                   | One small "room" object per lesson                                                                               |
| Call relay (TURN) and group calls (SFU)     | **Cloudflare Realtime**                              | About 1,000 GB/month free                  | Only needed when a direct connection fails, or for groups                                                        |
| Email (verification, reminders, receipts)   | **Resend** (fallback: Brevo)                         | 3,000 emails/month                         | Simple API. Sends from the domain once it is bought.                                                             |
| Reminders                                   | Cloudflare Cron Triggers                             | Free                                       | Hourly job sends emails                                                                                          |
| Domain                                      | `tutora.co.zw`                                       | About US$5–15/year from a .co.zw registrar | Kept configurable (`PUBLIC_SITE_URL`). Until it is bought, the site runs on a free `*.workers.dev` address.      |

**Expected cost: $0/month plus the domain.** If Tutora ever goes over the free limits, Workers Paid costs $5/month.
Main trade-off: Neon sleeps when idle, so the first request after a quiet period takes about 0.5–1 s longer. Public pages are cached at the edge, so visitors will not notice.

### App stack

- **SvelteKit** with the Cloudflare adapter. It sends very little JavaScript, and public pages need almost none.
- **Better Auth**: email + password, email verification, **TOTP 2FA for the tutor**, rate limits, secure cookies. Sessions are stored in Postgres.
- **Drizzle ORM** + Neon serverless driver. **Zod** validates every input on the server.
- **Paraglide (inlang)** for i18n: `messages/en.json` now, `sn.json` / `nd.json` later. Only the strings a page uses are sent to the browser.
- **pdf-lib** generates receipt PDFs on the server.
- **Vitest** for unit and integration tests. **Playwright** for end-to-end tests and a slow-3G check.
- PWA: a manifest and a small service worker that caches the app shell and the public pages.

### Data budget

- Homepage target: **under 100 KB** (the brief allows 300 KB). Text uses the phone's own font, so fonts cost 0 KB. The wordmark is an inline SVG of about 2 KB. The tutor photo is a 96 px AVIF/WebP of about 6 KB. CSS is about 10 KB. JS is about 5 KB, only for the menu.
- Uploaded images are resized and re-encoded in the browser before upload (this also strips EXIF data and saves the student's data). The server checks them again and rejects anything that is not a clean image.

## 2. Lesson room: technology and data use

- **Plain WebRTC**, with signalling through a Cloudflare Durable Object. No Jitsi: the free meet.jit.si now needs a login and limits embedded calls, and self-hosting Jitsi needs a paid server.
  - **One-to-one:** direct peer-to-peer call. Cloudflare TURN relays it only when a network blocks direct connections.
  - **Small groups:** Cloudflare Realtime SFU, so each student sends their audio once instead of once per person.
- **Default is audio only:** Opus codec at about 24 kbps with silence suppression.
- **Whiteboard:** vector strokes (points, not images) sent over a WebRTC data channel and also saved in the room object, so a student who reconnects sees the board again.
- Chat and file sharing go over the same room (files go to R2, with a 5 MB limit).
- Tutor "lets in" each student. Only students booked on that lesson can get a room token.
- Connection indicator (good / weak / reconnecting) uses WebRTC stats, with automatic ICE restart and reconnect.

| Mode                         | Approx. data per hour, per person           |
| ---------------------------- | ------------------------------------------- |
| Audio + whiteboard (default) | **about 15–25 MB**                          |
| + video at 360p (optional)   | about 150–250 MB extra                      |
| + screen share (optional)    | about 50–150 MB, depending on what is shown |

For comparison, a Zoom or Meet video call uses roughly 500 MB–1 GB per hour.

## 3. Design (proposal, see Figma)

- **Palette:** Msasa green `#0E6B52` (primary), Deep green `#0A4F3D`, Clay `#B4531A` (accent text), Ochre `#E3A33B` (decoration only, never as small text on white), Ink `#1C2620`, Slate `#5B665F`, Paper `#FBF8F2`, Mint `#E3F1EA`. Every text pairing used meets WCAG AA.
- **Wordmark: Option A — APPROVED.** Lowercase serif `tutora` with an ochre "o" ("a rising sun"). The "t" icon from option B is kept for the PWA and the favicon.
  - Files: `brand/wordmark.svg` (for light backgrounds), `brand/wordmark-on-dark.svg`, `brand/icon.svg`. Text is outlined, so no font is downloaded. About 2.7 KB gzipped.
- Type: system fonts for all UI text. The wordmark is an SVG.
- Buttons are 48 px tall with a 12 px radius. Icons are simple line SVGs, no emoji.

## 4. Phases

1. ✅ **Foundation (built):** SvelteKit + Cloudflare project, Neon schema and migrations, Better Auth (roles: `tutor`, `student`, `parent`; tutor 2FA), design tokens, i18n setup, security headers (CSP, HSTS), CI on GitHub Actions (lint, typecheck, tests), and a deploy to Cloudflare from `main`.
2. ✅ **Public site:** home, about, subjects, results (with consent), reviews (verified students only, tutor can hide but not edit), price setting, WhatsApp button, privacy and terms pages.
3. ✅ **Bookings + calendar:** weekly availability, booking requests, accept / decline / propose a new time, group size, cancellation window, day and week calendar, the tutor's own events, `.ics` files, and email + WhatsApp-link reminders.
4. ✅ **Payments:** proof upload, cash, confirm / reject, numbered receipts as PDF, packages with a balance that counts down, owed / paid view per student, monthly totals, CSV export. Amounts are stored as integer cents. USD by default, ZiG optional.
5. ✅ **Lesson room:** as described in section 2.
6. ✅ **Tutor tools:** Today screen, students list and notes, homework, settings.
7. ✅ **Hardening:** `/security-review` with all findings fixed, test coverage for the items in §11 of the brief, and a Lighthouse check on throttled slow 3G with a low-end phone profile.

Each phase ends with a deploy to a preview URL for you to check.

## 5. Decisions so far

| Item                   | Decision                                                                 |
| ---------------------- | ------------------------------------------------------------------------ |
| Wordmark               | Option A (approved)                                                      |
| Figma design direction | Approved                                                                 |
| WhatsApp number        | Set by the tutor in the setup wizard / Settings (no number in the code). |

## 6. Still open

- Creating the Cloudflare, Neon and Resend accounts (docs/DEPLOY.md). The first deploy is blocked on this.
- The tutor's email address for `TUTOR_EMAIL`.
- Subjects and levels; one-to-one, groups, or both; phone or laptop; prices and whether to show them; domain purchase; payment account details; photo and bio.
