CREATE TABLE "photo_slot" (
	"slot" text PRIMARY KEY NOT NULL,
	"storage_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"credit" text,
	"rights_confirmed" boolean DEFAULT false NOT NULL,
	"set_by" text,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "photo_slot" ADD CONSTRAINT "photo_slot_set_by_user_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- the homepage photo the owner already chose moves to its slot (nothing is lost)
INSERT INTO "photo_slot" ("slot", "storage_key", "version", "rights_confirmed", "set_at")
SELECT 'home', p."value", GREATEST(1, COALESCE((SELECT NULLIF(v."value", '')::int FROM "site_content" v WHERE v."key" = 'hero_photo_v'), 1)), true, p."created_at"
FROM "site_content" p WHERE p."key" = 'hero_photo' AND p."value" <> ''
ON CONFLICT ("slot") DO NOTHING;--> statement-breakpoint
DELETE FROM "site_content" WHERE "key" IN ('hero_photo', 'hero_photo_v');
