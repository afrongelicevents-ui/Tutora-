-- There can only ever be one tutor (admin) account.
CREATE UNIQUE INDEX IF NOT EXISTS "one_tutor" ON "user" ("role") WHERE "role" = 'tutor';
