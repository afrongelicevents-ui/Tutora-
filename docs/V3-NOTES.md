# Tutora v3: notes for developers

How the v3 code is organised (read with `docs/DECISIONS.md`).

## Roles and areas

- `/student/*` students only, `/parent/*` parents only, `/tutor/*` approved tutors (2FA), `/owner/*` the platform owner.
  The outer wall is `areaAccess` in `src/lib/server/guards.ts` (run in `hooks.server.ts` for every request);
  every page and form action checks again (`requireRole`, `requireTutor`).
- Parents never sign up directly. They join with a child's Family Connection code (`/code`).
- What a parent may see of a child is decided ONLY by `parentAccess(db, parentId, studentId)` in
  `src/lib/server/family.ts`. Every parent page must call it per child and show nothing if `!ok`.
  Check-ins: only `sharedCheckins()` (never the note). Private messages and tutor notes are never shown.

## Core modules (stable APIs)

| Module            | What                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `family.ts`       | invite codes, links, sharing, guardian permissions, younger children's logins             |
| `checkins.ts`     | learning check-ins (`addCheckin`, `sharedCheckins`, `latestForTutor`)                     |
| `school.ts`       | "My school work" (entered by student/parent, checked by tutor)                            |
| `progress.ts`     | results (`recordResult`), `topicScores`, `weakTopics`, `overallProgress`, `examReadiness` |
| `study.ts`        | weekly plan, focus sessions, `todaysPlan`, `streak`, `weekSummary`                        |
| `after-accept.ts` | runs after a tutor accepts a booking: meeting link + messages to student and family       |
| `tools/*`         | Connected Tools (OAuth, encrypted tokens, Meet/Teams/Drive/Kahoot!)                       |

Every number shown comes from rows in these tables; with no rows, screens show an honest empty state.

## UI

- Design tokens and v3 building blocks are in `src/lib/styles/app.css` (`.screen`, `.plumcard`, `.softcard`,
  `.rows`, `.chips/.chip`, `.stat3`, `.meter`, `.tag`, `.eyebrow`, `.back`, `.section-h`, `.note`, `.tutorcard`).
  Page-specific styles go in the component's own `<style>`.
- Phone (390px) first; wider screens get the side navigation from `AppShell.svelte` and may use `.screen.wide-2`.
- Few icons, no emoji, no gradients (except the welcome photo fade). Currency USD from tutors' own prices.
- All text is in `messages/en.json` (Paraglide). Use `m.key()`.
- Low data: no new client libraries without a reason; images as small WebP; Google scripts load only when a
  person taps a Drive button.
