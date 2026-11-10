# Deploying Tutora

This is a one-time setup. All the services below have free plans. After setup, every push to `main` that passes the tests deploys automatically.

## 1. Neon (database)

1. Sign up at https://neon.tech (free plan). Create a project called `tutora` and pick the region closest to Zimbabwe that Neon offers.
2. Copy the connection string (Dashboard → Connect). It looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`.

## 2. Resend (email)

1. Sign up at https://resend.com (free plan).
2. Create an API key.
3. **Before the domain is bought:** Resend only sends to your own email address. That's enough for testing.
4. **After the domain is bought:** add `tutora.co.zw` in Resend → Domains, and add the DNS records it shows. Then set `EMAIL_FROM` to `Tutora <hello@tutora.co.zw>`.

## 3. Cloudflare (website)

1. Sign up at https://dash.cloudflare.com (free plan).
2. Note your **Account ID** (shown on the right of the Workers & Pages page).
3. Create an **API token**: My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template.
4. Set the app's secrets. On a computer with Node 22 and pnpm, run these in the repo:

   ```sh
   pnpm install
   pnpm exec wrangler login
   pnpm exec wrangler secret put DATABASE_URL        # Neon connection string
   pnpm exec wrangler secret put BETTER_AUTH_SECRET  # output of: openssl rand -base64 32
   pnpm exec wrangler secret put TUTOR_EMAIL         # the tutor's email address
   pnpm exec wrangler secret put RESEND_API_KEY
   pnpm exec wrangler secret put EMAIL_FROM          # e.g. Tutora <onboarding@resend.dev>
   pnpm exec wrangler secret put ORIGIN              # e.g. https://tutora.<your-subdomain>.workers.dev
   ```

## 4. GitHub (automatic deploys)

In the repo, go to Settings → Secrets and variables → Actions and add:

| Secret                  | Value                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | The token from step 3                                                               |
| `CLOUDFLARE_ACCOUNT_ID` | The account ID from step 3                                                          |
| `DATABASE_URL`          | The Neon connection string. It's used to apply database changes before each deploy. |

Then merge to `main`. The **Deploy** workflow runs once **CI** passes. You can also start it by hand from the Actions tab.

## 5. First login as the tutor

The tutor account is never created through the public **Sign up** form. That way nobody else can claim it first.

1. Open `https://<your site>/setup` and type the `TUTOR_EMAIL` address.
2. Open the email and choose a password using the link. This proves you own the inbox.
3. Log in. The site asks you to turn on two-step verification: use Google Authenticator or Microsoft Authenticator, and write down the backup codes.

Once the tutor account is set up, the `/setup` page just says "already set up".

**Recommended:** in GitHub → Settings → Environments → `production`, add yourself as a **required reviewer**. Then every deploy waits for your approval.

## 6. When the domain is bought

1. Add `tutora.co.zw` to Cloudflare. In Workers → tutora → Settings → Domains & Routes, add a custom domain.
2. Update the `ORIGIN` secret to `https://tutora.co.zw`.
3. Verify the domain in Resend and update `EMAIL_FROM`.

## Local development

```sh
cp .env.example .env              # fill in BETTER_AUTH_SECRET and TUTOR_EMAIL
createdb tutora_dev               # local Postgres 16
pnpm install
pnpm db:migrate
pnpm dev                          # emails are printed in the terminal
pnpm test                         # set TEST_DATABASE_URL to also run the database tests
```
