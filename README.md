# Tutora

Low-data tutoring website and PWA for one tutor in Zimbabwe.

- Plan, hosting and design decisions: [docs/PLAN.md](docs/PLAN.md)
- Deploying and local setup: [docs/DEPLOY.md](docs/DEPLOY.md)
- Brand files: `brand/`. Figma: https://www.figma.com/design/DxxUgk80UR8qcOo21dYc0m

## Stack

SvelteKit on Cloudflare Workers · Neon Postgres (Drizzle) · Better Auth (email verification, TOTP 2FA) · Zod · Paraglide i18n (`messages/*.json`) · Vitest

## Commands

| Command            | What it does                                                      |
| ------------------ | ----------------------------------------------------------------- |
| `pnpm dev`         | Local dev server (http://localhost:5173)                          |
| `pnpm check`       | Type-check                                                        |
| `pnpm lint`        | Prettier + ESLint                                                 |
| `pnpm test`        | Unit tests (+ database tests when `TEST_DATABASE_URL` is set)     |
| `pnpm build`       | Production build for Cloudflare                                   |
| `pnpm db:generate` | Create a migration after changing `src/lib/server/db/*.schema.ts` |
| `pnpm db:migrate`  | Apply migrations                                                  |
| `pnpm auth:schema` | Regenerate Better Auth tables after changing auth plugins         |
