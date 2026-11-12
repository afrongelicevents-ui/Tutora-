# 08 · Schools, consent and privacy (Academic Partnership)

**Not legal advice.** This is a plan for discussion. A Zimbabwean lawyer who knows the Cyber and Data Protection Act should review the consent form, Privacy Policy and Terms before the Academic Partnership goes live. Law research was done by web search on 12 November 2026; sources are listed at the end.

## 1. What the Academic Partnership is

A **premium, optional** service in which, with a parent's **written consent**, a named teacher at the child's school and the child's Tutora tutor share agreed information about **one child, for named subjects, for a limited time**. Schools take part only if they choose to. Tutora never connects to school systems or pulls school records.

## 2. The consent form

### Who signs

- **The parent or legal guardian** — always. Under the Act a child is anyone **under 18**, and processing a child's data needs a parent's or guardian's consent; the controller must make reasonable efforts to check that the consent really comes from the parent or guardian [L2, L3].
- **The child (assent)** — recommended for older children (proposal: 12 and over; a lawyer should confirm the age). A short, simple screen on the child's own login: "Your parent wants your tutor and your teacher to share these things about your schoolwork. Is that OK with you?" If the child says no, Tutora tells the parent and does not start the partnership.
- **The teacher** — accepts their own terms (confidentiality, use only for this child's learning, no copying out of Tutora).
- **The school** — a separate written agreement with Tutora (outside the app) that it is willing to take part. Never assumed.

### What the form must say (plain words)

1. Who Tutora is and how to contact it (and its Data Protection Officer once appointed).
2. The **child's name**, the **school**, the **teacher(s) by name**, and the **subjects**.
3. **Exactly what will be shared, in each direction**, as tick boxes (for example: topic plan and test dates from the teacher; lesson summaries, assessment results and attendance from the tutor). Anything not ticked is not shared.
4. **Why**: to help the child's learning. Not for school discipline, rankings or marketing.
5. **Who can see it**: the named teacher(s), the tutor(s) with an accepted lesson, the parent, the child, and Tutora admin only for support and safety (logged).
6. **How long**: start date and **end date** (default end of term; maximum 12 months). After that access stops automatically.
7. **Withdrawal**: the parent can withdraw **at any time** with one button; access stops at once; withdrawal does not affect anything already lawfully shared.
8. **Where data is kept**: Tutora's servers are outside Zimbabwe (Cloudflare, Neon). The form must explain this and the safeguards (see §6).
9. **Your rights**: see, correct, export (exists: `/account/export`) and delete data; complain to Tutora and to POTRAZ.
10. **Cost** of the premium service (when set) and that saying no has no effect on normal tutoring.
11. Signature: full name typed, tick "I am this child's parent or legal guardian", date and time (stored with the IP address), and a PDF copy for the parent.

### Scope rules in the system

- Consent is **per child × per school × per teacher × per subject × per item type**.
- A teacher sees **only** consented children, subjects and items — no search, no list of other students, no payments, no contact details beyond what is needed.
- Tutors see school-shared items only for children they actively teach.

## 3. Access controls

- New role `teacher`; pages under `/partner/...`; every query filtered by an **active, non-expired, non-withdrawn consent** (same pattern as the `tutor_id` filter, D43).
- **Two-step login (authenticator)** required for teachers, like tutors and the owner today.
- Admin verifies each teacher (school confirms the person works there) before activation.
- File links stay private and expire after 10 minutes (exists, D17/`files.ts`).
- Suspension takes effect at once because logins are checked on every request (exists, D58).

## 4. Access and audit logs

| What is logged                                                            | Who can see it                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Every **view** of partnership data (who, which child, which record, when) | The parent (for their child), Tutora admin                     |
| Every **share** (upload, message, result sent)                            | Parent, admin                                                  |
| Consent signed, changed, renewed, withdrawn, expired                      | Parent, admin, the teacher and tutor involved (for their part) |
| Admin actions (exists today: `audit_log`)                                 | Admin                                                          |
| Admin **reads** of children's records (new)                               | Admin; shown to the parent on request                          |

Logs are kept for the retention period below and are append-only (no edit button).

## 5. Record of communications

All tutor ↔ teacher messages stay **inside Tutora** (`partnership_message`), linked to the consent. The parent can read all of them. No private side channels are encouraged; if WhatsApp is used outside Tutora, it is outside the partnership's protections, and the form should say so.

## 6. Data minimisation, retention and transfers

- **Collect less:** no school ID numbers, no school reports uploaded wholesale, no photos of children. Only the ticked items.
- **Retention (proposal for the lawyer):** partnership messages and shared items deleted or anonymised **6 months after** the partnership ends; consent records and access logs kept longer (e.g. 2 years) as proof of lawful processing.
- **Account deletion** already removes personal details and keeps money records as "Deleted user" (D77, D80); extend it to partnership data.
- **Cross-border transfer:** the Act (sections 28–29) allows transfers to countries with adequate protection and sets conditions otherwise [L1, L4]. Tutora's hosting is outside Zimbabwe, so the lawyer must confirm the legal basis (consent wording and/or adequacy) for all of Tutora, not only the partnership.

## 7. Breach handling (plan)

1. Contain (suspend accounts, rotate keys — the deploy workflow can reset the database password).
2. Find out what, whose and how many records were affected (access logs help).
3. Tell POTRAZ and affected parents within the time the law requires (**timing to be confirmed by the lawyer**; not verified in this check).
4. Write down what happened and what was fixed (in the admin audit log).

## 8. The Cyber and Data Protection Act [Chapter 12:07] (2021) — key points found

| Topic                   | What sources say                                                                                                                                                                                                                                                                       | Source     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Authority               | **POTRAZ** is the Data Protection Authority; it can audit, issue directives and prosecute                                                                                                                                                                                              | L1, L5     |
| Licensing               | **SI 155 of 2024** (Data Protection Regulations) requires a **data controller licence** from POTRAZ for organisations processing data of **50 or more people**; licences last **12 months**, renewal 3 months before expiry; four tiers by number of data subjects (Tier 1 = 50–1,000) | L5, L6     |
| Licence fees            | Reported as about **$50 to $2,500 a year** depending on tier — **not verified** against POTRAZ's official schedule; **check before applying**                                                                                                                                          | L6         |
| Data Protection Officer | Controllers must appoint a **DPO** who independently monitors compliance (audits, impact assessments). Deadlines reported for 2024–2025 have passed                                                                                                                                    | L5, L6     |
| Consent                 | Processing sensitive data needs consent or another legal ground; consent does not remove other duties                                                                                                                                                                                  | L2, L3     |
| Children                | Child = under 18; parent/guardian consent; reasonable efforts to verify it; parent/guardian can exercise the child's rights; regulations add impact assessments for children's data                                                                                                    | L2, L3, L7 |
| Cross-border            | Sections 28–29: transfers to countries with adequate protection; controllers outside Zimbabwe using local means must name a local representative                                                                                                                                       | L4         |

**Implication for Tutora:** Tutora already processes data of students and parents, so it likely needs a **POTRAZ licence and a DPO now**, not only when the partnership launches. Put this first in Phase 6, or earlier.

## 9. What Tutora already does (from the code and DECISIONS.md)

- Parent name and phone **required for under-18s** (database check `profile_minor_needs_parent`).
- **Consent timestamp** stored at sign-up (`profile.consent_at`).
- **Download my data** (`/account/export`, JSON) and **delete my account** (`/account`, D77, D80).
- **No public student photos**; tutor photo is the only public image (D19); photos stripped of location data (D18).
- **Results** shown only with the tutor's permission tick and first names/initials (D27); reviews show first names only (D34).
- **Lesson-room chat is not saved** (D57); room set-up messages are deleted after the lesson (`cleanupSignals` in `room.ts`).
- **Private files** behind 10-minute signed links (D17).
- **Each tutor's data is separate** and tested (D43).
- **Two-step login** for tutors and the owner (D46, D47); logins checked every request (D58); rate limits and bot trap (D76).
- **Audit log** of owner actions (`/owner/audit`, D75).
- **Test site separate** with fake data only (D55, D59).
- Privacy Policy and Terms mention the Act but are **drafts** (D78).

Gaps: no DPO named, no licence noted, no record of what data is processed (a processing register), no access log for reads, no written retention periods, no breach procedure.

## Sources (checked 12 Nov 2026)

- L1 — Cyber and Data Protection Act, 2021 (ZimLII): https://zimlii.org/akn/zw/act/2021/5/eng@2022-03-11
- L2 — Michalsons, overview of Zimbabwe's Act: https://www.michalsons.com/blog/zimbabwes-cyber-and-data-protection-act-overview/78795
- L3 — DLA Piper Data Protection Laws of the World, Zimbabwe: https://www.dlapiperdataprotection.com/index.html?c=ZW&t=law
- L4 — MISA Zimbabwe, compliance guide for data controllers: https://zimbabwe.misa.org/2025/03/14/navigating-the-data-protection-act-requirements-ensuring-compliance-for-zimbabwean-data-controllers
- L5 — DLA Piper Africa, quick-start guide to the Regulations (SI 155 of 2024): https://www.dlapiperafrica.com/en/zimbabwe/insights/2024/A-Quick-Start-Guide-to-Zimbabwes-Data-Protection-Regulations
- L6 — TechZim on licence fee tiers: https://techzim.co.zw/2024/11/zimbabwes-whatsapp-group-admin-license-fees-depend-on-the-group-sizes-from-50-to-2500 ; CITE: https://cite.org.zw/potraz-data-licence-fees-slammed-as-costly-burden-on-businesses-and-consumers/
- L7 — NewsDay, SI 155 of 2024 and children's data: https://www.newsday.co.zw/standard-people/article/200033237/statutory-instrument-155-of-2024-a-new-era-for-data-protection-in-zimbabwe

Section numbers differ between draft and enacted versions in some sources — the lawyer should check against the gazetted text.
