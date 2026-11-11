CREATE TABLE "enrollment" (
	"tutor_id" text NOT NULL,
	"user_id" text NOT NULL,
	"level" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_tutor_id_user_id_pk" PRIMARY KEY("tutor_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tutor_profile" (
	"tutor_id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"plan" text DEFAULT 'free' NOT NULL,
	"plan_until" timestamp with time zone,
	"tutor_name" text,
	"headline" text,
	"bio" text,
	"qualifications" text,
	"years_teaching" integer,
	"teaching_style" text,
	"town" text,
	"photo_key" text,
	"photo_version" integer DEFAULT 0 NOT NULL,
	"lesson_modes" text DEFAULT 'online' NOT NULL,
	"group_mode" text DEFAULT 'one_to_one' NOT NULL,
	"max_group_size" integer DEFAULT 4 NOT NULL,
	"lesson_minutes" integer DEFAULT 60 NOT NULL,
	"cancel_hours" integer DEFAULT 24 NOT NULL,
	"default_price_cents" integer,
	"show_prices" boolean DEFAULT false NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"whatsapp_number" text,
	"phone" text,
	"contact_email" text,
	"bank_name" text,
	"bank_account_name" text,
	"bank_account_number" text,
	"bank_branch" text,
	"ecocash_number" text,
	"ecocash_name" text,
	"innbucks_number" text,
	"innbucks_name" text,
	"payment_note" text,
	"results_consent" boolean DEFAULT false NOT NULL,
	"setup_step" integer DEFAULT 0 NOT NULL,
	"setup_done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutor_profile_group" CHECK ("tutor_profile"."max_group_size" between 2 and 20),
	CONSTRAINT "tutor_profile_len" CHECK ("tutor_profile"."lesson_minutes" between 15 and 240),
	CONSTRAINT "tutor_profile_slug_ok" CHECK ("tutor_profile"."slug" ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$')
);
--> statement-breakpoint
DROP INDEX "review_one_per_user";--> statement-breakpoint
ALTER TABLE "availability" ADD COLUMN "tutor_id" text;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "tutor_id" text;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "tutor_id" text;--> statement-breakpoint
ALTER TABLE "charge" ADD COLUMN "tutor_id" text;--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "tutor_id" text;--> statement-breakpoint
ALTER TABLE "lesson" ADD COLUMN "tutor_id" text;--> statement-breakpoint
ALTER TABLE "lesson_package" ADD COLUMN "tutor_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "tutor_id" text;--> statement-breakpoint
ALTER TABLE "result_highlight" ADD COLUMN "tutor_id" text;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "tutor_id" text;--> statement-breakpoint
ALTER TABLE "student_package" ADD COLUMN "tutor_id" text;--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "tutor_id" text;--> statement-breakpoint
-- Until now there was one tutor. Give all existing data to that tutor (if there is one).
DROP INDEX IF EXISTS "one_tutor";--> statement-breakpoint
INSERT INTO "tutor_profile" ("tutor_id","slug","status","approved_at","tutor_name","headline","bio","qualifications","years_teaching","teaching_style","town","photo_key","photo_version","lesson_modes","group_mode","max_group_size","lesson_minutes","cancel_hours","default_price_cents","show_prices","currency","whatsapp_number","phone","contact_email","bank_name","bank_account_name","bank_account_number","bank_branch","ecocash_number","ecocash_name","innbucks_number","innbucks_name","payment_note","results_consent","setup_step","setup_done_at")
SELECT t.id, coalesce(nullif(trim(both '-' from left(regexp_replace(lower(coalesce(s.tutor_name, '')), '[^a-z0-9]+', '-', 'g'), 40)), ''), 'tutor'), 'active', now(), s.tutor_name, s.headline, s.bio, s.qualifications, s.years_teaching, s.teaching_style, s.town, s.photo_key, s.photo_version, s.lesson_modes, s.group_mode, s.max_group_size, s.lesson_minutes, s.cancel_hours, s.default_price_cents, s.show_prices, s.currency, s.whatsapp_number, s.phone, s.contact_email, s.bank_name, s.bank_account_name, s.bank_account_number, s.bank_branch, s.ecocash_number, s.ecocash_name, s.innbucks_number, s.innbucks_name, s.payment_note, s.results_consent, s.setup_step, s.setup_done_at
FROM (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) t
LEFT JOIN "site_settings" s ON s.id = 1;--> statement-breakpoint
INSERT INTO "enrollment" ("tutor_id","user_id","level")
SELECT t.id, p.user_id, p.level
FROM (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) t
CROSS JOIN "profile" p JOIN "user" u ON u.id = p.user_id AND u.role IN ('student','parent')
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "availability" SET "tutor_id" = (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) WHERE "tutor_id" IS NULL;--> statement-breakpoint
UPDATE "booking" SET "tutor_id" = (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) WHERE "tutor_id" IS NULL;--> statement-breakpoint
UPDATE "calendar_event" SET "tutor_id" = (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) WHERE "tutor_id" IS NULL;--> statement-breakpoint
UPDATE "charge" SET "tutor_id" = (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) WHERE "tutor_id" IS NULL;--> statement-breakpoint
UPDATE "homework" SET "tutor_id" = (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) WHERE "tutor_id" IS NULL;--> statement-breakpoint
UPDATE "lesson" SET "tutor_id" = (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) WHERE "tutor_id" IS NULL;--> statement-breakpoint
UPDATE "lesson_package" SET "tutor_id" = (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) WHERE "tutor_id" IS NULL;--> statement-breakpoint
UPDATE "payment" SET "tutor_id" = (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) WHERE "tutor_id" IS NULL;--> statement-breakpoint
UPDATE "result_highlight" SET "tutor_id" = (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) WHERE "tutor_id" IS NULL;--> statement-breakpoint
UPDATE "review" SET "tutor_id" = (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) WHERE "tutor_id" IS NULL;--> statement-breakpoint
UPDATE "student_package" SET "tutor_id" = (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) WHERE "tutor_id" IS NULL;--> statement-breakpoint
UPDATE "subject" SET "tutor_id" = (SELECT id FROM "user" WHERE role = 'tutor' ORDER BY created_at LIMIT 1) WHERE "tutor_id" IS NULL;--> statement-breakpoint
DELETE FROM "payment" WHERE "tutor_id" IS NULL;--> statement-breakpoint
DELETE FROM "charge" WHERE "tutor_id" IS NULL;--> statement-breakpoint
DELETE FROM "attendee" WHERE "lesson_id" IN (SELECT id FROM "lesson" WHERE "tutor_id" IS NULL);--> statement-breakpoint
DELETE FROM "homework" WHERE "tutor_id" IS NULL;--> statement-breakpoint
DELETE FROM "review" WHERE "tutor_id" IS NULL;--> statement-breakpoint
DELETE FROM "availability" WHERE "tutor_id" IS NULL;--> statement-breakpoint
DELETE FROM "calendar_event" WHERE "tutor_id" IS NULL;--> statement-breakpoint
DELETE FROM "result_highlight" WHERE "tutor_id" IS NULL;--> statement-breakpoint
DELETE FROM "booking" WHERE "tutor_id" IS NULL;--> statement-breakpoint
DELETE FROM "student_package" WHERE "tutor_id" IS NULL;--> statement-breakpoint
DELETE FROM "lesson" WHERE "tutor_id" IS NULL;--> statement-breakpoint
DELETE FROM "lesson_package" WHERE "tutor_id" IS NULL;--> statement-breakpoint
DELETE FROM "subject" WHERE "tutor_id" IS NULL;--> statement-breakpoint
ALTER TABLE "availability" ALTER COLUMN "tutor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "tutor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_event" ALTER COLUMN "tutor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "charge" ALTER COLUMN "tutor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "homework" ALTER COLUMN "tutor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson" ALTER COLUMN "tutor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_package" ALTER COLUMN "tutor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ALTER COLUMN "tutor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "result_highlight" ALTER COLUMN "tutor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "review" ALTER COLUMN "tutor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "student_package" ALTER COLUMN "tutor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subject" ALTER COLUMN "tutor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_profile" ADD CONSTRAINT "tutor_profile_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enrollment_user_idx" ON "enrollment" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tutor_profile_slug" ON "tutor_profile" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tutor_profile_status_idx" ON "tutor_profile" USING btree ("status");--> statement-breakpoint
ALTER TABLE "availability" ADD CONSTRAINT "availability_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework" ADD CONSTRAINT "homework_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson" ADD CONSTRAINT "lesson_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_package" ADD CONSTRAINT "lesson_package_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_highlight" ADD CONSTRAINT "result_highlight_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_package" ADD CONSTRAINT "student_package_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_tutor_idx" ON "booking" USING btree ("tutor_id","status");--> statement-breakpoint
CREATE INDEX "charge_tutor_user_idx" ON "charge" USING btree ("tutor_id","user_id");--> statement-breakpoint
CREATE INDEX "lesson_tutor_idx" ON "lesson" USING btree ("tutor_id","starts_at");--> statement-breakpoint
CREATE INDEX "payment_tutor_idx" ON "payment" USING btree ("tutor_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "review_one_per_tutor_user" ON "review" USING btree ("tutor_id","user_id");--> statement-breakpoint
CREATE INDEX "subject_tutor_idx" ON "subject" USING btree ("tutor_id");