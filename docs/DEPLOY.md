# Putting Tutora online (from a phone)

Free plans only. You make two keys and paste them into GitHub. Everything else (database, tables, website address, deploy, and the separate TEST site with fake data) is done by the **Deploy** workflow. No email service is needed: the tutor types their own details on the site.

Tip: on GitHub in a phone browser, tap **⋮ → Desktop site** if a settings page doesn't react.

1. **Neon key:** https://console.neon.tech/app/settings/api-keys → **Create new API key** → name `tutora` → **Create** → **Copy**.
2. **GitHub:** https://github.com/afrongelicevents-ui/Tutora-/settings/secrets/actions/new → Name `NEON_API_KEY` → paste → **Add secret**.
3. **Cloudflare account:** https://dash.cloudflare.com/sign-up → sign up → open the confirmation email → tap the link.
4. **Cloudflare key:** https://dash.cloudflare.com/profile/api-tokens → **Create Token** → next to **Edit Cloudflare Workers** tap **Use template** → Account Resources: _All accounts_ → Zone Resources: _All zones_ → **Continue to summary** → **Create Token** → **Copy**.
5. **GitHub:** same page as step 2 → Name `CLOUDFLARE_API_TOKEN` → paste → **Add secret**.
6. **Deploy:** https://github.com/afrongelicevents-ui/Tutora-/actions/workflows/deploy.yml → **Run workflow** → branch `main` → tick _Reset the database password_ the first time → **Run workflow**. When it's green, the run's summary shows the website address.
7. **The owner sets up their account:** open the setup link with the one-time code (`<website address>/setup?code=…`, given by whoever ran the deploy) → name, email, password → log in → authenticator app. From **Tutora admin** you approve tutors who join at `/join`, or add tutors yourself.

The workflow picks the Neon project called "tutora", or your only project, or creates one. If you have several projects, rename the right one to `tutora`.

## The test site

The same workflow also publishes `tutora-test` (its own address, its own database branch "test", fake data only). Tick _TEST site: wipe it and fill it with fresh fake data_ when running Deploy to start over, or use **Reset test data** in the test site's Tutora admin. The shared password of the test logins is made during the deploy and only shown encrypted in the logs.

## Optional, later

- **Emails** (booking confirmations, reminders, "forgot password" links): sign up at https://resend.com, then in Cloudflare → Workers & Pages → **tutora** → **Settings → Variables and Secrets** add `RESEND_API_KEY` and `EMAIL_FROM`, both as type **Secret**, (`Tutora <onboarding@resend.dev>`; your own domain later).
- **Own domain** (`tutora.co.zw`): Cloudflare → tutora → **Settings → Domains & Routes → Add → Custom domain**.
- **Lesson reminders** (needs emails): add GitHub secrets `SITE_URL` (the website address) and `CRON_SECRET` (any long random text), then run Deploy again: it passes `CRON_SECRET` to Cloudflare.
- **Calls on difficult networks:** Cloudflare → **Realtime → TURN** → create → add `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` as Cloudflare secrets.

## For developers: local setup

```sh
cp .env.example .env              # fill in DATABASE_URL and BETTER_AUTH_SECRET
createdb tutora_dev               # local Postgres 16
pnpm install
pnpm db:migrate
pnpm dev                          # emails are printed in the terminal
pnpm test                         # set TEST_DATABASE_URL to also run the database tests
```
