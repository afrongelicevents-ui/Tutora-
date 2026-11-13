# End-to-end flows

Real browsers, several real test accounts talking to each other, pressing the real buttons.

```sh
# a database with the fake TEST data, and a dev server on it
createdb tutora_e2e
DATABASE_URL=postgres://…/tutora_e2e pnpm db:migrate
DATABASE_URL=postgres://…/tutora_e2e TEST_SITE=1 TEST_PASSWORD=Shot-pass-123 npx tsx scripts/deploy/seed-test.ts
DATABASE_URL=postgres://…/tutora_e2e TEST_SITE=1 BETTER_AUTH_SECRET=… ORIGIN=http://localhost:5173 pnpm dev &

E2E_DB=postgres://…/tutora_e2e E2E_PASSWORD=Shot-pass-123 pnpm test:e2e
```

The database helper (`sql`) is only used to move time forward (e.g. a lesson to "now") and to
check what was saved; every action is a real click.
