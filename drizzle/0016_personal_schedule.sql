CREATE TABLE "personal_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"kind" text NOT NULL,
	"label" text,
	"days" jsonb NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_activity_start" CHECK ("personal_activity"."start_minute" between 0 and 1439),
	CONSTRAINT "personal_activity_end" CHECK ("personal_activity"."end_minute" between 1 and 1440),
	CONSTRAINT "personal_activity_order" CHECK ("personal_activity"."end_minute" > "personal_activity"."start_minute")
);
--> statement-breakpoint
ALTER TABLE "personal_activity" ADD CONSTRAINT "personal_activity_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personal_activity_student" ON "personal_activity" USING btree ("student_id");