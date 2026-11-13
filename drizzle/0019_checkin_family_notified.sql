ALTER TABLE "checkin" ADD COLUMN "family_notified_at" timestamp with time zone;--> statement-breakpoint
-- check-ins from before this change were already told to family straight away
UPDATE "checkin" SET "family_notified_at" = "created_at" WHERE "shared_with_family" = true;
