CREATE TABLE "buddy_block" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buddy_block_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "buddy_code" (
	"code" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "buddy_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"a_id" text NOT NULL,
	"b_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"need_parent_a" boolean DEFAULT false NOT NULL,
	"need_parent_b" boolean DEFAULT false NOT NULL,
	"approved_a" timestamp with time zone,
	"approved_b" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buddy_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	"preset" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buddy_report" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"reported_id" text NOT NULL,
	"what" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_card" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text,
	"bio" text,
	"bio_status" text DEFAULT 'none' NOT NULL,
	"grade" text,
	"school" text,
	"subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"favourite_subject" text,
	"goals" text,
	"birth_date" date,
	"photo_key" text,
	"photo_version" integer DEFAULT 0 NOT NULL,
	"photo_status" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buddy_block" ADD CONSTRAINT "buddy_block_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_block" ADD CONSTRAINT "buddy_block_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_code" ADD CONSTRAINT "buddy_code_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_link" ADD CONSTRAINT "buddy_link_a_id_user_id_fk" FOREIGN KEY ("a_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_link" ADD CONSTRAINT "buddy_link_b_id_user_id_fk" FOREIGN KEY ("b_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_message" ADD CONSTRAINT "buddy_message_from_id_user_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_message" ADD CONSTRAINT "buddy_message_to_id_user_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_report" ADD CONSTRAINT "buddy_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_report" ADD CONSTRAINT "buddy_report_reported_id_user_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_report" ADD CONSTRAINT "buddy_report_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_card" ADD CONSTRAINT "student_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "buddy_code_student" ON "buddy_code" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "buddy_link_pair" ON "buddy_link" USING btree ("a_id","b_id");--> statement-breakpoint
CREATE INDEX "buddy_link_b" ON "buddy_link" USING btree ("b_id");--> statement-breakpoint
CREATE INDEX "buddy_message_to" ON "buddy_message" USING btree ("to_id","created_at");--> statement-breakpoint
CREATE INDEX "buddy_report_status" ON "buddy_report" USING btree ("status","created_at");