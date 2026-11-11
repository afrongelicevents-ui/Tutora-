# Putting Tutora online (from a phone)

Free plans only. About 20 minutes. You need **two accounts**: Cloudflare (website) and Neon (database, you already have it). No email service is needed: the tutor types their own email, name and details on the site.

Tip: on GitHub in a phone browser, tap **⋮ → Desktop site** if a settings page doesn't react.

## 1. Neon: get a fresh database address (3 min)

The old password was shared in a chat, so make a new one first.

1. https://console.neon.tech → your project → **Branches** → `main` → **Roles** → `neondb_owner` → **⋮ → Reset password** → confirm.
2. **Dashboard → Connect** → copy the connection string (starts with `postgresql://`). This is **DATABASE_URL**. Don't paste it anywhere except step 3.

## 2. Cloudflare: account, ID and token (7 min)

1. https://dash.cloudflare.com/sign-up → sign up → confirm your email.
2. Open https://dash.cloudflare.com/?to=/:account/workers-and-pages once (this creates your free `workers.dev` address). Copy the **Account ID** shown on that page (or under the ⋮ / account menu). This is **CLOUDFLARE_ACCOUNT_ID**.
3. https://dash.cloudflare.com/profile/api-tokens → **Create Token** → **Edit Cloudflare Workers** → **Use template** → Account Resources: your account; Zone Resources: **All zones** → **Continue to summary** → **Create Token** → copy it. This is **CLOUDFLARE_API_TOKEN**.

## 3. GitHub: three secrets (3 min)

Open https://github.com/afrongelicevents-ui/Tutora-/settings/secrets/actions/new and add, one at a time (Name, then Secret, then **Add secret**):

| Name                    | Secret        |
| ----------------------- | ------------- |
| `CLOUDFLARE_API_TOKEN`  | from step 2.3 |
| `CLOUDFLARE_ACCOUNT_ID` | from step 2.2 |
| `DATABASE_URL`          | from step 1.2 |

## 4. GitHub: put the latest code on `main` and publish (5 min)

1. https://github.com/afrongelicevents-ui/Tutora-/compare/main...ccr-767e9d9a-el14qg → **Create pull request** → **Create pull request** → **Merge pull request** → **Confirm merge**.
2. https://github.com/afrongelicevents-ui/Tutora-/actions/workflows/deploy.yml → **Run workflow** → branch `main` → **Run workflow**. Wait for the green tick (about 3 minutes). (It also runs by itself after each merge once CI is green.)
3. Tap the finished run → **deploy** → the last step shows the address, like `https://tutora.<your-name>.workers.dev`. That is the website.

## 5. The tutor claims the site (do this straight away)

1. Open `https://tutora.<your-name>.workers.dev/setup`.
2. The tutor types **their own** name, email and a password → **Create my tutor account**. After this, `/setup` is closed for everyone else.
3. Log in → set up the authenticator app (Google Authenticator or Microsoft Authenticator, free) → write down the backup codes.
4. The setup wizard asks for photo, subjects, prices, free times, WhatsApp and payment details. Anything can be skipped and changed later in **Settings**. Login email and password: **Settings → Account**.

If you are setting it up for a client to look at first, you can claim it yourself with a test email; when they say yes, change the name, email and password in **Settings** to theirs.

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
