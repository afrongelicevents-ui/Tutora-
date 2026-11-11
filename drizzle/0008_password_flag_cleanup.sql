ALTER TABLE "user" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" DROP COLUMN "must_change_password";--> statement-breakpoint
DROP SEQUENCE "public"."receipt_no_seq";--> statement-breakpoint
-- Students are now linked to a tutor only with an accepted lesson, a package, a charge or a
-- payment. Remove links made earlier by a request alone.
DELETE FROM "enrollment" e
WHERE NOT EXISTS (SELECT 1 FROM "attendee" a JOIN "lesson" l ON l.id = a.lesson_id WHERE a.user_id = e.user_id AND l.tutor_id = e.tutor_id)
  AND NOT EXISTS (SELECT 1 FROM "student_package" sp WHERE sp.user_id = e.user_id AND sp.tutor_id = e.tutor_id)
  AND NOT EXISTS (SELECT 1 FROM "charge" c WHERE c.user_id = e.user_id AND c.tutor_id = e.tutor_id)
  AND NOT EXISTS (SELECT 1 FROM "payment" p WHERE p.user_id = e.user_id AND p.tutor_id = e.tutor_id);
