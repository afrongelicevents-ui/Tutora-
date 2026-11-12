/**
 * v3: parents move to Family Connection (same statements as drizzle/0011_v3_family_data.sql,
 * kept here so the test site's fake data goes through exactly the same conversion, and so
 * it can be tested). Nothing is deleted; money records stay with the parent who paid.
 */
import { sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';

export const LEGACY_FAMILY_SQL: string[] = [
	`INSERT INTO "child" ("parent_id", "name", "level")
SELECT p."user_id", btrim(p."child_name"), p."level"
FROM "profile" p JOIN "user" u ON u."id" = p."user_id"
WHERE u."role" = 'parent' AND p."child_name" IS NOT NULL AND btrim(p."child_name") <> ''
  AND NOT EXISTS (SELECT 1 FROM "child" c WHERE c."parent_id" = p."user_id")`,
	`UPDATE "booking" b SET "child_id" = c."id"
FROM "child" c
WHERE b."user_id" = c."parent_id" AND b."child_id" IS NULL
  AND (SELECT count(*) FROM "child" c2 WHERE c2."parent_id" = c."parent_id") = 1
  AND EXISTS (SELECT 1 FROM "user" u WHERE u."id" = c."parent_id" AND u."role" = 'parent')`,
	`UPDATE "attendee" a SET "child_id" = c."id"
FROM "child" c
WHERE a."user_id" = c."parent_id" AND a."child_id" IS NULL
  AND (SELECT count(*) FROM "child" c2 WHERE c2."parent_id" = c."parent_id") = 1
  AND EXISTS (SELECT 1 FROM "user" u WHERE u."id" = c."parent_id" AND u."role" = 'parent')`,
	`INSERT INTO "user" ("id", "name", "email", "email_verified", "role")
SELECT 'kid_' || c."id" || '_' || substr(md5(c."parent_id" || ':' || c."id"), 1, 10),
       c."name",
       'child-' || c."id" || '-' || substr(md5(c."parent_id" || ':' || c."id"), 1, 10) || '@kids.tutora.invalid',
       true, 'student'
FROM "child" c
WHERE c."student_id" IS NULL
ON CONFLICT DO NOTHING`,
	`UPDATE "child" SET "student_id" = 'kid_' || "id" || '_' || substr(md5("parent_id" || ':' || "id"), 1, 10)
WHERE "student_id" IS NULL`,
	`INSERT INTO "profile" ("user_id", "is_under_18", "parent_name", "parent_phone", "parent_email", "level", "managed", "consent_at")
SELECT c."student_id", (pp."phone" IS NOT NULL), pu."name", pp."phone", pu."email", c."level", true,
       coalesce(pp."consent_at", now())
FROM "child" c
JOIN "user" pu ON pu."id" = c."parent_id"
LEFT JOIN "profile" pp ON pp."user_id" = c."parent_id"
ON CONFLICT ("user_id") DO NOTHING`,
	`INSERT INTO "school_info" ("student_id", "year", "entered_by")
SELECT c."student_id", c."school_year", c."parent_id" FROM "child" c
WHERE c."school_year" IS NOT NULL AND btrim(c."school_year") <> ''
ON CONFLICT DO NOTHING`,
	`INSERT INTO "family_link" ("parent_id", "student_id", "guardian", "status")
SELECT c."parent_id", c."student_id", true, 'active' FROM "child" c
JOIN "user" u ON u."id" = c."parent_id"
WHERE u."role" = 'parent'
ON CONFLICT DO NOTHING`,
	`UPDATE "booking" b SET "user_id" = c."student_id"
FROM "child" c JOIN "user" u ON u."id" = c."parent_id" AND u."role" = 'parent'
WHERE b."child_id" = c."id" AND b."user_id" = c."parent_id"`,
	`UPDATE "attendee" a SET "user_id" = c."student_id"
FROM "child" c JOIN "user" u ON u."id" = c."parent_id" AND u."role" = 'parent'
WHERE a."child_id" = c."id" AND a."user_id" = c."parent_id"`,
	`INSERT INTO "enrollment" ("tutor_id", "user_id", "level")
SELECT DISTINCT l."tutor_id", a."user_id", c."level"
FROM "attendee" a JOIN "lesson" l ON l."id" = a."lesson_id"
JOIN "child" c ON c."student_id" = a."user_id"
ON CONFLICT DO NOTHING`,
	`INSERT INTO "enrollment" ("tutor_id", "user_id", "level")
SELECT DISTINCT b."tutor_id", b."user_id", c."level"
FROM "booking" b JOIN "child" c ON c."student_id" = b."user_id"
WHERE b."status" = 'accepted'
ON CONFLICT DO NOTHING`
];

/** From drizzle/0012_managed_minors.sql: younger children's accounts are always under 18. */
export const MANAGED_MINORS_SQL = `UPDATE "profile" SET "is_under_18" = true WHERE "managed" = true AND "is_under_18" = false`;

export async function legacyParentsToFamily(db: DB) {
	for (const q of LEGACY_FAMILY_SQL) await db.execute(sql.raw(q));
	await db.execute(sql.raw(MANAGED_MINORS_SQL));
}
