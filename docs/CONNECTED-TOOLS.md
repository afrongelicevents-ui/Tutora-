# Connected Tools: setting up Google and Microsoft

Connected Tools are optional. Without the settings below, Tutora works fully: lessons use the
low-data room, and the Connect buttons say "Not available yet — the Tutora team is setting this
up". Nothing is ever shown as connected unless a real account was connected.

What each tool does, and the access it asks for:

| Tool            | Who              | Access (OAuth scopes)                                     | Used for                                                                                                                                   |
| --------------- | ---------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Google Meet     | tutors           | `calendar.events`                                         | creates a Meet link for each online lesson in the tutor's own Google Calendar (no attendees are added, so no student email goes to Google) |
| Google Drive    | tutors, students | `drive.file`                                              | only files the person picks in the Google Picker; nothing else in their Drive                                                              |
| Microsoft Teams | tutors           | `OnlineMeetings.ReadWrite`, `User.Read`, `offline_access` | creates a Teams meeting for each online lesson (work or school accounts only)                                                              |
| Kahoot!         | tutors, students | none                                                      | quiz links; scores are imported from the Kahoot! report file or typed in                                                                   |

Students under 18 can connect Google Drive only when their guardian allows outside tools
(Family settings). Tokens are encrypted (AES-GCM) on the server, never sent to the browser and
never logged. Anyone can disconnect at any time (Google access is revoked at Google too).

You need the two web addresses of the site:

- live site: `https://tutora.<your-name>.workers.dev` (or your own domain, if `ORIGIN` is set)
- test site: `https://tutora-test.<your-name>.workers.dev`

They are printed at the end of each Deploy run ("Website: ..."). Below, `<site>` means each of them.

---

## 1. Google (Meet, Drive and the Drive file picker)

All steps are in the Google Cloud console: <https://console.cloud.google.com/>.

### 1.1 Project

1. Top bar → project picker → **New project**. Name: `Tutora`. Create, then select it.
2. **Project number**: Home / Dashboard → "Project info" card → copy the **Project number**
   (digits only). This is `GOOGLE_APP_ID`.

### 1.2 Turn on the APIs

**APIs & Services → Library**, search and **Enable** each:

- **Google Calendar API** (Meet links are made through Calendar events)
- **Google Drive API**
- **Google Picker API**

### 1.3 OAuth consent screen (Google Auth Platform)

**APIs & Services → OAuth consent screen** (newer consoles: **Google Auth Platform**):

1. **Branding**: App name `Tutora`, user support email, app logo (optional), app home page
   `<live site>`, privacy policy `<live site>/privacy`, terms `<live site>/terms`, developer
   contact email. **Authorised domains**: add your own domain if you have one (e.g.
   `tutora.co.zw`). Google does not accept a shared `workers.dev` address as your domain, so
   publishing and verification (1.6) need your own domain; Testing mode works without it.
2. **Audience**: User type **External**. While the app is in **Testing**, only the test users
   you add (up to 100 Google accounts) can connect; add your own and your tutors' Google
   accounts there.
3. **Data access** → **Add or remove scopes**, add exactly:
   - `openid`
   - `.../auth/userinfo.email` (shown as "email")
   - `https://www.googleapis.com/auth/calendar.events` (sensitive)
   - `https://www.googleapis.com/auth/drive.file` (non-sensitive)
     Save.

### 1.4 OAuth client (web application)

**APIs & Services → Credentials → Create credentials → OAuth client ID**:

- Application type: **Web application**, name `Tutora web`.
- **Authorised JavaScript origins** (the Drive picker asks Google for its own short-lived token
  in the browser, so the site itself must be listed):
  - `https://tutora.<your-name>.workers.dev`
  - `https://tutora-test.<your-name>.workers.dev`
  - your own domain, if any (e.g. `https://tutora.co.zw`)
  - for development only: `http://localhost:5173`
- **Authorised redirect URIs** (exactly, no trailing slash):
  - `https://tutora.<your-name>.workers.dev/tools/callback/google`
  - `https://tutora-test.<your-name>.workers.dev/tools/callback/google`
  - your own domain, if any: `https://tutora.co.zw/tools/callback/google`
  - development only: `http://localhost:5173/tools/callback/google`
- Create. Copy the **Client ID** (`GOOGLE_CLIENT_ID`) and **Client secret**
  (`GOOGLE_CLIENT_SECRET`). Keep the secret private.

### 1.5 API key for the Picker

**Credentials → Create credentials → API key**, then **Edit API key**:

- Name: `Tutora picker`.
- **Application restrictions**: **Websites (HTTP referrers)**, add:
  - `https://tutora.<your-name>.workers.dev/*`
  - `https://tutora-test.<your-name>.workers.dev/*`
  - your own domain, if any: `https://tutora.co.zw/*`
  - development only: `http://localhost:5173/*`
- **API restrictions**: **Restrict key** → tick only **Google Picker API**.
- Save. Copy the key: `GOOGLE_API_KEY`. (It is public by design: it is sent to browsers that
  open the picker. The restrictions above are what protect it.)

### 1.6 Verification (before real users)

- `drive.file` is non-sensitive; `calendar.events` is a **sensitive** scope.
- In **Testing** mode everything works for the listed test users; their consent expires after
  7 days (they then simply connect again).
- To let any tutor connect: **Audience → Publish app**. Because of `calendar.events`, Google
  asks for **verification**: a privacy policy on your domain, a short screen-recording video
  showing the Connect flow and how Meet links appear on a lesson, and a reason for the scope
  ("create a Google Meet link in the tutor's own calendar for each confirmed online lesson;
  no attendees are added"). Verification usually takes a few days to a few weeks. Until it is
  done, unverified apps show a warning screen and are limited to 100 users.
- If you do not want verification, tutors can still use Drive (only `drive.file`), but then
  remove `calendar.events` from the consent screen and do not offer Meet.

---

## 2. Microsoft (Teams meetings)

Teams meetings can only be created through Microsoft Graph for **work or school accounts**
(Microsoft 365 business or education). Personal Microsoft accounts (Outlook.com, Hotmail,
Live) cannot create online meetings through the API, so they are not offered.

Microsoft Entra admin centre: <https://entra.microsoft.com/> (any free Entra tenant works; a
personal Microsoft account can create one at <https://portal.azure.com/>).

1. **Identity → Applications → App registrations → New registration**
   - Name: `Tutora`
   - **Supported account types**: **Accounts in any organizational directory (Any Microsoft
     Entra ID tenant - Multitenant)**. (Not "personal accounts": they cannot use Teams via Graph.)
   - **Redirect URI**: platform **Web**,
     `https://tutora.<your-name>.workers.dev/tools/callback/microsoft`
   - Register.
2. **Authentication** → under Web → **Add URI** for the other sites:
   - `https://tutora-test.<your-name>.workers.dev/tools/callback/microsoft`
   - your own domain, if any: `https://tutora.co.zw/tools/callback/microsoft`
   - development only: `http://localhost:5173/tools/callback/microsoft`
     Leave "Implicit grant" unticked. Save.
3. **API permissions → Add a permission → Microsoft Graph → Delegated permissions**, add:
   - `OnlineMeetings.ReadWrite`
   - `User.Read`
   - `offline_access`
   - `openid`, `email`
     (No admin consent is needed for these in most schools and companies; some organisations
     require an admin to approve outside apps. Then the tutor sees "Need admin approval" and
     asks their IT team.)
4. **Certificates & secrets → New client secret**. Description `Tutora`, expiry 24 months
   (put a reminder in your calendar to make a new one before it expires). Copy the **Value**
   right away: `MS_CLIENT_SECRET`.
5. **Overview** → copy **Application (client) ID**: `MS_CLIENT_ID`.
6. Optional, for a wider audience: **Branding & properties** → publisher domain and
   **Publisher verification** (needs a Microsoft Partner Network ID). Without it, users see
   "unverified" on the consent screen.

---

## 3. Secrets for Cloudflare

| Secret                 | What                                             | Required                                                 |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | OAuth client ID (1.4)                            | for Google                                               |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret (1.4)                        | for Google                                               |
| `GOOGLE_API_KEY`       | Picker API key (1.5)                             | for the Drive picker                                     |
| `GOOGLE_APP_ID`        | Project number (1.1)                             | for the Drive picker                                     |
| `MS_CLIENT_ID`         | Application (client) ID (2.5)                    | for Teams                                                |
| `MS_CLIENT_SECRET`     | Client secret value (2.4)                        | for Teams                                                |
| `TOOLS_KEY`            | 32+ random characters that encrypt stored tokens | optional (otherwise derived from the site's auth secret) |

Make `TOOLS_KEY` with e.g. `openssl rand -base64 48`. If you set it later or change it, every
person has to connect their tools again (old tokens can no longer be decrypted). The same
applies if `BETTER_AUTH_SECRET` changes while `TOOLS_KEY` is not set.

### With the Deploy workflow (recommended)

GitHub → the repository → **Settings → Secrets and variables → Actions → New repository
secret**, add each secret above with exactly that name. The Deploy workflow passes the ones
that are set to **both** Workers, `tutora` (live) and `tutora-test` (test), on the next run
(Actions → Deploy → Run workflow). Empty or missing ones are simply left out. Values are never
printed.

To use different Google/Microsoft apps for the test site, add the secrets to the GitHub
**environments** instead (Settings → Environments → `production` / `test` → Environment
secrets); environment secrets win over repository secrets.

Removing a GitHub secret does not delete it from Cloudflare. To turn a tool off, delete it in
Cloudflare too (below).

### By hand (Cloudflare dashboard or wrangler)

- Dashboard: **Workers & Pages** → `tutora` → **Settings → Variables and Secrets → Add**,
  type **Secret**. Repeat for `tutora-test`.
- Or with wrangler, from the repository folder:

  ```sh
  npx wrangler secret put GOOGLE_CLIENT_ID              # live worker "tutora"
  npx wrangler secret put GOOGLE_CLIENT_ID --env test   # test worker "tutora-test"
  ```

  (Repeat for each secret; wrangler asks for the value, so it is not saved in your shell history.)

### Local development

Add the same names to `.env` (git-ignored) and use the `http://localhost:5173` origins and
redirect URIs listed above.

---

## 4. Check that it works

1. Sign in as a tutor → More → **Connected tools**. The Google and Microsoft cards now show
   **Connect** buttons (not "Not available yet").
2. Connect Google, allow Calendar and Drive. The cards show **Connected** and the access each
   one has.
3. Under "How online lessons run", choose **Google Meet** and save.
4. Accept an online booking: the lesson page shows **Join on Google Meet**, and the event is in
   the tutor's Google Calendar (with no guests). If anything fails, the lesson simply uses the
   low-data room.
5. On a lesson page, **Attach from Google Drive**: pick a file. It appears under Lesson
   materials and the student gets view access (for students without a real email, e.g.
   younger children's logins, Tutora asks the tutor to share it themselves).
6. **Disconnect** removes the connection; Google's access is revoked as well
   (<https://myaccount.google.com/permissions> no longer lists Tutora).

If Connect returns with "The connection could not be finished": check the redirect URI is
listed exactly (scheme, host, `/tools/callback/google`), and that the client secret is current.

---

## 5. Kahoot!

Nothing to set up. Kahoot! offers no public API a tutor's app can use for scores (its Reports
API is only for Kahoot! 360 enterprise organisations and needs credentials from Kahoot!), so
Tutora does not sync scores automatically. Tutors download the game report from Kahoot!
(Reports → the game → Download report, `.xlsx`) and upload it at **Connected tools → Kahoot!
→ Add scores from a Kahoot! report**, then match each player to a student. Single scores can
also be typed in.
