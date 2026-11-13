ALTER TABLE "personal_activity" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "personal_task" ADD COLUMN "removed_at" timestamp with time zone;