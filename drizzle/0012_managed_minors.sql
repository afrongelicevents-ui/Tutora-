ALTER TABLE "profile" DROP CONSTRAINT "profile_minor_needs_parent";--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_minor_needs_parent" CHECK (not "profile"."is_under_18" or "profile"."managed" or ("profile"."parent_name" is not null and "profile"."parent_phone" is not null));--> statement-breakpoint
-- Younger children's accounts (made by a parent, or moved from the old parent accounts) are always
-- treated as under 18, so their guardian manages permissions.
UPDATE "profile" SET "is_under_18" = true WHERE "managed" = true AND "is_under_18" = false;
