# Morning report: 11 November 2026

Everything is saved on GitHub, on the branch `ccr-767e9d9a-el14qg`. **Nothing is online yet**: no accounts were created and nothing was deployed.

## What works

**For visitors**

- The homepage shows the tutor's photo, intro, subjects, prices (or "Ask for price"), results, reviews, contact details and a WhatsApp button.
- Anything the tutor hasn't filled in yet is hidden. A brand-new site just says "Coming soon".
- There are About, Subjects, Results, Reviews, Privacy and Terms pages.

**For students and parents**

- Sign up, confirm your email, log in. Students under 18 must give a parent's name and phone number.
- Book a lesson or a free 15-minute intro chat: choose the subject, online or in person, and a free time. You can also join a group lesson that has a place left.
- Cancel up to the time the tutor allows. Add lessons to your phone's calendar.
- Pay into the account and upload a screenshot, or tap "I paid cash". Download a PDF receipt once the tutor confirms.
- Buy a lesson package and see how many lessons are left.
- Get homework, hand in answers and read the tutor's feedback. Leave a review after your first lesson.
- Join the online lesson: audio, whiteboard and chat. Video and screen share are optional.

**For the tutor**

- A setup wizard on first login, phone-friendly and skippable: name, photo, bio, subjects and levels, one-to-one / groups / both, prices, free times, lesson length, WhatsApp, phone, contact email, payment details (bank, EcoCash, InnBucks) and currency.
- Everything can be changed later in **Settings**, including the login email (a confirmation link goes to the new address).
- **Today** screen: today's lessons, requests to answer (accept, decline or suggest another time) and payments to confirm or reject.
- One calendar with day and week views, holding online lessons, in-person lessons and the tutor's own events.
- Students list with contacts, parent details, private notes per lesson, homework, and who has paid, is waiting or owes.
- Money page: monthly totals, a CSV spreadsheet download, receipts, and recording cash received.
- Hide abusive reviews. Two-step login protection is required.

**Quality checks**

- **Tests:** 98 automatic tests pass. They cover bookings, payment confirm and reject, receipts, package balances, permissions, the lesson room, uploads and double-tap safety.
- **Phone walkthrough:** I clicked through the whole app at phone size (390 px) in a browser. No pages scroll sideways and there were no errors.
- **Speed:** on simulated slow 3G with a slow phone, the homepage appears in about 1 second. It is about 29 KB and loads no JavaScript.
- **Security:** an independent reviewer checked the code twice and everything they found is fixed. The most serious: tutor-only data could be read without logging in, through a technical back door. That is now closed, with two locks.

**Bugs I found and fixed while testing**

- On slow phones, anything typed before the page finished loading could be wiped.
- The student's whiteboard was blank after the tutor let them in.
- Payments could be counted against the wrong lesson.

## Open the demo on your phone (no internet needed afterwards)

The demo is one file, `docs/demo/tutora-demo.html`, about 95 KB. It uses sample data and has a **Visitor / Student / Tutor** switch at the top.

**Android (Chrome):**

1. On your phone, open **github.com** in Chrome and log in. The repository is private, so you must be logged in.
2. Open the **Tutora-** repository. Tap the branch name and choose **`ccr-767e9d9a-el14qg`**.
3. Tap **docs** → **demo** → **tutora-demo.html**.
4. Tap the **⋯** menu (or the download icon) → **Download** ("Download raw file").
5. Open the **Files** app → **Downloads** → tap **tutora-demo.html** → choose **Chrome**.
6. Use the switch at the top: Visitor → Student → Tutor. Things you do carry across roles. For example: as Student, upload a payment screenshot; switch to Tutor and confirm it; switch back to Student and open the receipt.

**iPhone:** the Files app shows HTML files as a preview that doesn't run the demo's buttons. The easiest way is to open the file on a computer (download it, then double-click it), or on an Android phone. Or tell me, and I'll make you a private web link instead.

## The only things you have to do to put it online

The exact clicks for each step are in **`docs/DEPLOY.md`**. In order:

1. **GitHub:** create a branch called `main` from `ccr-767e9d9a-el14qg` and make it the default branch. Check the repository is Private. _(2 minutes)_
2. **Neon** (database): sign up, create the project `tutora`, copy the connection string. _(5 minutes)_
3. **Resend** (email): sign up and create an API key. _(5 minutes)_
4. **Cloudflare:** sign up and create the file storage bucket `tutora-files` (it may ask for a card, but stays free). Copy your Account ID and create an API token. _(15 minutes)_
5. **GitHub:** add 3 secrets, then press **Run workflow** on "Deploy". _(5 minutes)_
6. **Cloudflare:** add the site's 7 secret settings, including the **tutor's email** and two long random passwords. _(10 minutes)_
7. **GitHub:** add 2 more secrets so reminder emails work. _(2 minutes)_
8. **The tutor:** opens `your-site/setup`, types their email, sets a password from the email link, turns on two-step login, then fills in the wizard. _(5 minutes, plus however long the wizard takes)_

## Please know

- **Not yet tested on the real services.** It hasn't run on the real Cloudflare and Neon services yet; I tested it locally. Small fixes may be needed on the first deploy.
- **The lesson room was tested between two browsers on one computer, not on two real phones on different networks.** Some Zimbabwean mobile networks may need the optional free Cloudflare TURN key (see "Optional" in `docs/DEPLOY.md`).
- **Shona and Ndebele:** all wording is in one file (`messages/en.json`), ready to translate. The translations themselves are not done.
- **The Privacy and Terms pages are drafts.** Please have them checked.
- **The real WhatsApp number is still in older commits** on this branch, although it has been removed from the code. If you want it gone from the history too, say so: it means rewriting commits that are already pushed.
- **Every choice I made without asking you is listed in `docs/DECISIONS.md`.** Most can be changed in the tutor's Settings.
