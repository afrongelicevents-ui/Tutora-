# 10 · Technical recommendation (cost-conscious)

All prices and limits below were checked by web search on **12 November 2026**. Direct visits to provider pages were blocked from the build machine, so figures come from search results quoting those pages and, where marked, from third-party summaries. **Check before buying.**

## 1. Stay on free tiers as long as possible

| Service                           | Free tier                                                                                                                                                                                                       | First paid step                                                                                                                                                                       | Source |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Cloudflare Workers                | **100,000 requests a day** (resets midnight UTC), **10 ms CPU** per request                                                                                                                                     | Workers Paid: **$5 a month minimum** per account. Included requests/overage prices **not verified** on Cloudflare's page (a third-party calculator says 10 million requests included) | S1, S6 |
| Neon Postgres                     | **100 compute-hours a month per project**, **0.5 GB storage per project** (one Neon FAQ says 1 GB — conflicting, check), scales to zero after 5 minutes idle; writes fail at the storage cap (no surprise bill) | Launch: **$0.106 per compute-hour** and **$0.35 per GB-month**, no monthly minimum                                                                                                    | S3     |
| Cloudflare R2                     | **10 GB-month storage**, 1 million write operations, 10 million read operations a month, **free downloads**                                                                                                     | **$0.015 per GB-month**, **$4.50 per million writes**, **$0.36 per million reads**                                                                                                    | S2     |
| Cloudflare TURN (call relay)      | **1,000 GB a month**                                                                                                                                                                                            | **$0.05 per GB**                                                                                                                                                                      | S5     |
| Resend (email)                    | **3,000 emails a month, 100 a day**                                                                                                                                                                             | Pro **$20 a month** for 50,000                                                                                                                                                        | S4     |
| Web Push                          | No per-message fee (browser push services)                                                                                                                                                                      | —                                                                                                                                                                                     | S13    |
| GitHub Actions (hourly reminders) | Used today; cost **not re-verified** in this check                                                                                                                                                              | —                                                                                                                                                                                     | —      |
| Domain `tutora.co.zw`             | —                                                                                                                                                                                                               | **Price not verified**                                                                                                                                                                | —      |

## 2. What will hit the limits first (from the audit)

1. **Lesson room traffic.** The room polls the server every 1.5 s while connecting and every 4 s once live (`src/lib/room-client.ts`), each poll touching the database. That is about **900 requests per person per hour** → about 1,800 for a one-hour one-to-one lesson. On its own this allows roughly **55 one-hour lessons a day** under the 100,000 cap, and it keeps Neon awake (using compute-hours).
   - **Cheap fix (Phase 2/7):** once the call is connected, poll much less often (e.g. every 15–30 s, only to notice someone leaving) since chat, whiteboard and files already travel directly between phones (D21). Test on the test site.
   - **Later:** a Cloudflare Durable Object with WebSockets for signalling (planned in `PLAN.md`, not built). Whether this fits the free plan was **not verified** — check before choosing.
2. **Neon storage (0.5 GB).** Files are stored inside the database today (D39, `file_blob`). Photos are shrunk on the phone (D18, D31), but homework, proofs and future assessment photos add up.
   - **Move files to R2 when the database reaches about 0.3 GB.** The code is ready (`R2Store` in `src/lib/server/files.ts`, used when a `FILES` binding exists in `wrangler.jsonc`). Write a one-off script to copy old `file_blob` rows to R2.
3. **Neon compute-hours (100/month).** Any steady traffic (room polling, many visitors, the hourly job) keeps the database awake. A month has about 730 hours, so always-on at 1 compute unit would be about 730 compute-hours. Watch the Neon usage page monthly; at Launch prices each extra compute-hour is $0.106.

## 3. Low-data budgets (keep and enforce)

| Page type          | Budget (transferred, first visit)                                 | Today                          |
| ------------------ | ----------------------------------------------------------------- | ------------------------------ |
| Homepage           | **under 150 KB** (owner's budget)                                 | About 60 KB (D62)              |
| Other public pages | under 100 KB                                                      | Plain HTML, almost no JS (D30) |
| Logged-in pages    | under 80 KB, no JS unless needed                                  | Same                           |
| Daily check-in     | under 20 KB, works without JS                                     | New                            |
| Assessment page    | under 60 KB, text-first; images only if the tutor adds them       | New                            |
| Lesson room        | audio about 24 kbps (11–20 MB/hour); video optional at 360p (D21) | Exists                         |

Add an automatic check in CI (e.g. Playwright measuring transferred bytes on the homepage) so the budget cannot slip. Photos stay WebP and shrunk on the phone.

## 4. Web Push (Phase 3)

- Add a small **service worker** (none exists today; only `static/manifest.webmanifest`).
- Make **VAPID keys** once; store the private key as a Cloudflare secret (separate keys for the test site).
- `push_subscription` table; `/push/subscribe` route; send from the Worker and from the hourly job.
- iPhone: works only on iOS 16.4+ **after Add to Home Screen**, and permission must follow a tap (S13). Add a short guide in the design.

## 5. Defer these integrations

| Defer                      | Why                                                                                             | Revisit when                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Google Meet / Teams API    | OAuth verification, tokens, account-type limits unverified (S7, S9); a stored link does the job | Many tutors ask for auto-created links                              |
| Google Calendar API        | OAuth work; quota/charging statements conflict (S11)                                            | Tutors ask; offer a calendar feed first                             |
| SMS                        | Expensive per message to Zimbabwe (Plivo $0.1015–$0.3289, S15)                                  | Only for paid plans, low volume                                     |
| WhatsApp Business Platform | Business verification, templates, BSP choice                                                    | Paying families want it; utility ≈ $0.0040 per message (S17, check) |
| Kahoot / Google Forms      | Results would leave Tutora                                                                      | Never as the main assessment tool                                   |
| Paynow                     | Merchant account and fees (% not verified, S18)                                                 | First Tutora-only paid service (Phase 6)                            |
| Workers Paid ($5)          | Not needed yet                                                                                  | Requests near 100,000/day or CPU limits hit                         |

## 6. Security

- **Role gate in hooks stays the single outer wall** (`areaAccess()` in `guards.ts`, called from `hooks.server.ts`). Add the new areas `/parent` (role parent) and `/partner` (role teacher, with 2FA) there first, then in each page's load and actions.
- **Every new table that belongs to a tutor has `tutor_id`; every child-related query checks the child belongs to the parent** (or a consent exists). Add tests like `tenancy.db.test.ts` for parent ↔ child and teacher ↔ consent.
- **Audit logs:** keep `audit_log` for admin actions; add an **access log** for reads of children's data by tutors (sensitive pages), teachers and admins. Show parents their child's log.
- **2FA** for tutors, owner and teachers (authenticator app; exists for tutors and owner).
- Keep: rate limits on logins/uploads, bot trap on public forms (D76), uploads checked by content (D18), signed 10-minute file links, security headers and `private, no-store` on logged-in pages (`hooks.server.ts`).
- Consider Cloudflare Turnstile later (needs a key, D76) if bots appear.

## 7. Keeping the test site separate

- It already is: its own Worker (`env.test` in `wrangler.jsonc`, name `tutora-test`), its own Neon branch with its own password, a "TEST SITE — fake data" bar, and it wipes itself if it ever contains non-fake data (D55, D59).
- For every new feature: add fake data to `src/lib/server/seed.ts` (check-ins, assessments, a fake school and a fake consent) so it can be tried there first.
- Use **separate keys** on the test site for everything new: VAPID keys, Paynow **test mode** integration, Resend (or none), WhatsApp test number.
- **Never copy live data to the test site**, and never show fake data on the live site.

## Sources (all checked 12 Nov 2026)

- S1 — Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits
- S2 — Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/ ; Filebase summary: https://filebase.com/blog/cloudflare-r2-pricing-costs-savings-and-alternatives-in-2026/
- S3 — Neon pricing: https://neon.com/pricing ; Neon free-plan FAQ: https://neon.com/faqs/free-plan-limits-and-quotas
- S4 — Resend pricing: https://resend.com/pricing ; Resend docs: https://resend.com/docs/knowledge-base/what-is-resend-pricing
- S5 — Cloudflare Realtime (TURN/SFU) pricing: https://developers.cloudflare.com/realtime/pricing/
- S6 — Cloudflare Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/ ; third-party calculator: https://makerkit.dev/pricing-calculator/cloudflare
- S7 — Google Meet API `spaces.create`: https://developers.google.com/workspace/meet/api/reference/rest/v2/spaces/create
- S8 — Google Meet free limits: https://9to5google.com/2021/07/12/google-meet-group-limit/ ; https://tldv.io/blog/google-meet-time-limit/
- S9 — Teams Free limits: https://learn.microsoft.com/en-us/answers/questions/5616490/how-long-can-a-free-teams-video-call-last
- S10 — Jitsi as a Service: https://jitsi.org/jaas/ ; 8x8 video API: https://www.8x8.com/products/apis/video
- S11 — Google Calendar API usage limits: https://developers.google.com/workspace/calendar/api/guides/quota ; https://developers.google.com/calendar/pricing
- S12 — Kahoot!+ page: https://kahoot.com/ca/home/kahoot-plus/ ; forms.app comparison: https://forms.app/en/blog/the-top-kahoot-alternatives
- S13 — WebKit, Web Push for Web Apps on iOS and iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- S14 — Twilio Zimbabwe SMS guidelines: https://www.twilio.com/en-us/guidelines/zw/sms ; Twilio Zimbabwe pricing page (price not read): https://www.twilio.com/en-us/sms/pricing/zw
- S15 — Plivo Zimbabwe SMS pricing: https://www.plivo.com/sms/pricing/zw/
- S16 — Meta, Pricing on the WhatsApp Business Platform: https://developers.facebook.com/docs/whatsapp/pricing ; pricing updates: https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing
- S17 — SleekFlow per-message rate table (from 1 Oct 2026): https://help.sleekflow.io/en_US/pricing ; Zernio: https://zernio.com/blog/whatsapp-business-api-pricing
- S18 — Paynow Merchant FAQ: https://www.paynow.co.zw/Home/MerchantTutorial ; Paynow developer hub: https://developers.paynow.co.zw/docs/test_mode.html
