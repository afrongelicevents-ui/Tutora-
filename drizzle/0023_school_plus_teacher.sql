CREATE TABLE "partnership_plan" (
	"partnership_id" integer PRIMARY KEY NOT NULL,
	"goals" text,
	"topics" text,
	"exam_focus" text,
	"updated_by_name" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partnership_report" (
	"id" serial PRIMARY KEY NOT NULL,
	"partnership_id" integer NOT NULL,
	"month" text NOT NULL,
	"from_role" text NOT NULL,
	"from_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "partnership" ALTER COLUMN "consent_text" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "partnership" ALTER COLUMN "consent_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "partnership" ALTER COLUMN "consent_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "partnership" ADD COLUMN "teacher_id" text;--> statement-breakpoint
ALTER TABLE "partnership" ADD COLUMN "tutor_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partnership" ADD COLUMN "teacher_invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partnership" ADD COLUMN "active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "partnership" ADD COLUMN "declined_by" text;--> statement-breakpoint
ALTER TABLE "partnership_plan" ADD CONSTRAINT "partnership_plan_partnership_id_partnership_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."partnership"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partnership_report" ADD CONSTRAINT "partnership_report_partnership_id_partnership_id_fk" FOREIGN KEY ("partnership_id") REFERENCES "public"."partnership"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "partnership_report_one" ON "partnership_report" USING btree ("partnership_id","month","from_role");--> statement-breakpoint
ALTER TABLE "partnership" ADD CONSTRAINT "partnership_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partnership_teacher" ON "partnership" USING btree ("teacher_id");--> statement-breakpoint
-- old status names: a school link sent = teacher invited; a parent stop = ended (if it was
-- active) or withdrawn (before); an active legacy one keeps its consent and start date
UPDATE "partnership" SET "status" = 'teacher_invited', "teacher_invited_at" = "created_at", "tutor_accepted_at" = "created_at" WHERE "status" = 'school_invited';--> statement-breakpoint
UPDATE "partnership" SET "active_at" = coalesce("school_responded_at", "created_at"), "tutor_accepted_at" = "created_at" WHERE "status" = 'active';--> statement-breakpoint
UPDATE "partnership" SET "status" = CASE WHEN "school_responded_at" IS NOT NULL THEN 'ended' ELSE 'withdrawn' END WHERE "status" = 'stopped';
