# Putting Tutora online

Everything here uses free plans. Follow the steps in order; it takes about an hour the first time. Wherever it says **copy**, paste the value into a private note: you will need it a few steps later.

> **Nothing here has been done yet.** No accounts were created and nothing was deployed.

## Quick links

| Step                   | Link                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Make `main`         | https://github.com/afrongelicevents-ui/Tutora-/branches · then https://github.com/afrongelicevents-ui/Tutora-/settings                                                |
| 2. Neon                | https://console.neon.tech/signup                                                                                                                                      |
| 3. Resend              | https://resend.com/signup · keys: https://resend.com/api-keys                                                                                                         |
| 4. Cloudflare          | https://dash.cloudflare.com/sign-up · R2: https://dash.cloudflare.com/?to=/:account/r2/overview · tokens: https://dash.cloudflare.com/profile/api-tokens              |
| 5. GitHub secrets      | https://github.com/afrongelicevents-ui/Tutora-/settings/secrets/actions/new · run deploy: https://github.com/afrongelicevents-ui/Tutora-/actions/workflows/deploy.yml |
| 6. Cloudflare settings | https://dash.cloudflare.com/?to=/:account/workers-and-pages                                                                                                           |
| 8. Authenticator app   | Android: https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2 · iPhone: https://apps.apple.com/app/google-authenticator/id388497605   |

## Step 1. Make a `main` branch on GitHub (2 minutes)

The work is on the branch `ccr-767e9d9a-el14qg`. Automatic deploys run from `main`.

1. Open the repository on GitHub → **Code** tab → click the branch menu (top left, shows `ccr-767e9d9a-el14qg`) → **View all branches**.
2. Click **New branch**. Name: `main`. Source: `ccr-767e9d9a-el14qg`. Click **Create new branch**.
3. Go to **Settings** → **General** → **Default branch** → click the ⇄ icon → choose `main` → **Update** → **I understand**.
4. Make sure the repository is **Private**: Settings → General → scroll to **Danger Zone** → it should say "This repository is currently private".

## Step 2. Neon: the database (5 minutes)

1. Go to https://neon.tech and click **Sign up** (you can use your GitHub account).
2. **Create project** → name `tutora` → Postgres version 16 or newer → region: the one closest to Southern Africa that is offered (e.g. Europe/Frankfurt) → **Create**.
3. On the project dashboard click **Connect** → copy the **connection string** (starts with `postgresql://`, ends with `sslmode=require`). Copy it as **DATABASE_URL**.

## Step 3. Resend: emails (5 minutes)

1. Go to https://resend.com → **Sign up**.
2. **API Keys** → **Create API Key** → name `tutora` → permission "Sending access" → **Add**. Copy it as **RESEND_API_KEY** (it is shown once).
3. Until you buy the domain, Resend only delivers to the email address you signed up with. That is fine for testing with the tutor's own address.

## Step 4. Cloudflare: website + private files (15 minutes)

1. Go to https://dash.cloudflare.com → **Sign up** → confirm your email.
2. In the left menu click **R2 Object Storage** → **Create bucket** → name **`tutora-files`** (exactly) → location Automatic → **Create bucket**.
   _Cloudflare may ask you to add a card or PayPal to switch on R2. Storage stays free up to 10 GB; Tutora uses very little._
3. Click **Workers & Pages** in the left menu. On the right, copy your **Account ID** as **CLOUDFLARE_ACCOUNT_ID**.
4. Click your profile icon (top right) → **My Profile** → **API Tokens** → **Create Token** → template **Edit Cloudflare Workers** → **Use template**. Under _Account Resources_ choose your account; under _Zone Resources_ choose **All zones** → **Continue to summary** → **Create Token**. Copy it as **CLOUDFLARE_API_TOKEN**.

## Step 5. GitHub: secrets for automatic deploys (5 minutes)

Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add these three (Name = left, Secret = the value you copied):

| Name                    | Value         |
| ----------------------- | ------------- |
| `CLOUDFLARE_API_TOKEN`  | from step 4.4 |
| `CLOUDFLARE_ACCOUNT_ID` | from step 4.3 |
| `DATABASE_URL`          | from step 2.3 |

Then **Actions** tab → **Deploy** (left) → **Run workflow** → branch `main` → **Run workflow**. Wait for the green tick (about 3 minutes). It prepares the database and puts the website on Cloudflare.

## Step 6. Cloudflare: the website's settings (10 minutes)

1. Cloudflare → **Workers & Pages** → click **tutora**. Copy the address shown under _Domains_ (like `https://tutora.yourname.workers.dev`) as **SITE_URL**.
2. **Settings** → **Variables and Secrets** → **+ Add**. For each row: Type **Secret**, Name, Value → after the last one click **Deploy**.

| Name                 | Value                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | from step 2.3                                                                                |
| `ORIGIN`             | your SITE_URL (no slash at the end)                                                          |
| `BETTER_AUTH_SECRET` | a long random password: at least 32 letters and numbers (use a password manager's generator) |
| `TUTOR_EMAIL`        | the tutor's email address                                                                    |
| `RESEND_API_KEY`     | from step 3.2                                                                                |
| `EMAIL_FROM`         | `Tutora <onboarding@resend.dev>` (change after buying the domain)                            |
| `CRON_SECRET`        | another long random password (for lesson reminders)                                          |

## Step 7. Lesson reminders (2 minutes)

GitHub → **Settings** → **Secrets and variables** → **Actions** → add two more secrets:

| Name          | Value                       |
| ------------- | --------------------------- |
| `SITE_URL`    | from step 6.1               |
| `CRON_SECRET` | the same value as in step 6 |

Reminder emails then go out every hour, about 24 hours and 1 hour before each lesson.

## Step 8. The tutor claims the account (5 minutes, on the tutor's phone)

1. Open `SITE_URL/setup` (for example `https://tutora.yourname.workers.dev/setup`).
2. Type the **TUTOR_EMAIL** address → **Send set-up link**.
3. Open the email → tap the link → choose a password → log in.
4. Install **Google Authenticator** or **Microsoft Authenticator** (free) → scan the QR code → type the 6-digit code. **Write down the backup codes.**
5. The setup wizard starts: name, photo, subjects, prices, free times, WhatsApp, payment details. Anything can be skipped and finished later in **Settings**.

Done: the site is live. Share the address with students.

## Optional, later

- **Your own domain** (`tutora.co.zw`): Cloudflare → Workers & Pages → tutora → **Settings** → **Domains & Routes** → **+ Add** → Custom domain. Then change `ORIGIN` (step 6) to `https://tutora.co.zw`, add the domain in Resend → **Domains** (follow its DNS steps) and change `EMAIL_FROM` to `Tutora <hello@tutora.co.zw>`.
- **Calls on difficult networks:** Cloudflare → **Realtime** → **TURN** → **Create** → copy the Key ID and API token → add them as secrets `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` (step 6). Free tier.
- **Approve each deploy yourself:** GitHub → Settings → Environments → `production` → **Required reviewers** → add yourself.

## For developers: local setup

```sh
cp .env.example .env              # fill in BETTER_AUTH_SECRET and TUTOR_EMAIL
createdb tutora_dev               # local Postgres 16
pnpm install
pnpm db:migrate
pnpm dev                          # emails are printed in the terminal; files go to .data/
pnpm test                         # set TEST_DATABASE_URL to also run the database tests
pnpm demo                         # rebuild docs/demo/tutora-demo.html
```
