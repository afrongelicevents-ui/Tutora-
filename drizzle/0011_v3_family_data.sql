-- Tutora v3: parents move to Family Connection. Nothing is deleted.
-- Each child a parent added (or named at sign-up) becomes a younger child's student account
-- managed by that parent (the guardian). Their lessons and requests move to the child's
-- account; money records (charges, payments, receipts) stay with the parent who paid.

-- 1. Parents who only typed a child's name at sign-up: make that a child row.
INSERT INTO "child" ("parent_id", "name", "level")
SELECT p."user_id", btrim(p."child_name"), p."level"
FROM "profile" p JOIN "user" u ON u."id" = p."user_id"
WHERE u."role" = 'parent' AND p."child_name" IS NOT NULL AND btrim(p."child_name") <> ''
  AND NOT EXISTS (SELECT 1 FROM "child" c WHERE c."parent_id" = p."user_id");
--> statement-breakpoint
-- A parent with exactly one child: their requests and places without a child are for that child.
UPDATE "booking" b SET "child_id" = c."id"
FROM "child" c
WHERE b."user_id" = c."parent_id" AND b."child_id" IS NULL
  AND (SELECT count(*) FROM "child" c2 WHERE c2."parent_id" = c."parent_id") = 1
  AND EXISTS (SELECT 1 FROM "user" u WHERE u."id" = c."parent_id" AND u."role" = 'parent');
--> statement-breakpoint
UPDATE "attendee" a SET "child_id" = c."id"
FROM "child" c
WHERE a."user_id" = c."parent_id" AND a."child_id" IS NULL
  AND (SELECT count(*) FROM "child" c2 WHERE c2."parent_id" = c."parent_id") = 1
  AND EXISTS (SELECT 1 FROM "user" u WHERE u."id" = c."parent_id" AND u."role" = 'parent');
--> statement-breakpoint
-- 2. A student account for every child (no login yet: the parent can set one up later).
INSERT INTO "user" ("id", "name", "email", "email_verified", "role")
SELECT 'kid_' || c."id" || '_' || substr(md5(c."parent_id" || ':' || c."id"), 1, 10),
       c."name",
       'child-' || c."id" || '-' || substr(md5(c."parent_id" || ':' || c."id"), 1, 10) || '@kids.tutora.invalid',
       true, 'student'
FROM "child" c
WHERE c."student_id" IS NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "child" SET "student_id" = 'kid_' || "id" || '_' || substr(md5("parent_id" || ':' || "id"), 1, 10)
WHERE "student_id" IS NULL;
--> statement-breakpoint
INSERT INTO "profile" ("user_id", "is_under_18", "parent_name", "parent_phone", "parent_email", "level", "managed", "consent_at")
SELECT c."student_id", (pp."phone" IS NOT NULL), pu."name", pp."phone", pu."email", c."level", true,
       coalesce(pp."consent_at", now())
FROM "child" c
JOIN "user" pu ON pu."id" = c."parent_id"
LEFT JOIN "profile" pp ON pp."user_id" = c."parent_id"
ON CONFLICT ("user_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "school_info" ("student_id", "year", "entered_by")
SELECT c."student_id", c."school_year", c."parent_id" FROM "child" c
WHERE c."school_year" IS NOT NULL AND btrim(c."school_year") <> ''
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- 3. The parent becomes the child's guardian in Family Connection.
INSERT INTO "family_link" ("parent_id", "student_id", "guardian", "status")
SELECT c."parent_id", c."student_id", true, 'active' FROM "child" c
JOIN "user" u ON u."id" = c."parent_id"
WHERE u."role" = 'parent'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Students who made a parent account by mistake keep the old setup: only role "parent" moves.
-- 4. Lessons and requests that were for the child now sit on the child's account.
UPDATE "booking" b SET "user_id" = c."student_id"
FROM "child" c JOIN "user" u ON u."id" = c."parent_id" AND u."role" = 'parent'
WHERE b."child_id" = c."id" AND b."user_id" = c."parent_id";
--> statement-breakpoint
UPDATE "attendee" a SET "user_id" = c."student_id"
FROM "child" c JOIN "user" u ON u."id" = c."parent_id" AND u."role" = 'parent'
WHERE a."child_id" = c."id" AND a."user_id" = c."parent_id";
--> statement-breakpoint
-- 5. The child joins the student list of every tutor they had lessons or requests with.
INSERT INTO "enrollment" ("tutor_id", "user_id", "level")
SELECT DISTINCT l."tutor_id", a."user_id", c."level"
FROM "attendee" a JOIN "lesson" l ON l."id" = a."lesson_id"
JOIN "child" c ON c."student_id" = a."user_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "enrollment" ("tutor_id", "user_id", "level")
SELECT DISTINCT b."tutor_id", b."user_id", c."level"
FROM "booking" b JOIN "child" c ON c."student_id" = b."user_id"
WHERE b."status" = 'accepted'
ON CONFLICT DO NOTHING;
