CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target" text,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "child" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" text NOT NULL,
	"name" text NOT NULL,
	"level" text,
	"school_year" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favourite" (
	"user_id" text NOT NULL,
	"tutor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favourite_user_id_tutor_id_pk" PRIMARY KEY("user_id","tutor_id")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_pref" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email_off" boolean DEFAULT false NOT NULL,
	"reminders_off" boolean DEFAULT false NOT NULL,
	"homework_off" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_subject" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_content" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"topic" text DEFAULT 'help' NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "attendee" ADD COLUMN "attendance" text;--> statement-breakpoint
ALTER TABLE "attendee" ADD COLUMN "child_id" integer;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "child_id" integer;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "kind" text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "homework_answer" ADD COLUMN "checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "reply" text;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "replied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "report_reason" text;--> statement-breakpoint
ALTER TABLE "tutor_profile" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tutor_profile" ADD COLUMN "reject_reason" text;--> statement-breakpoint
ALTER TABLE "tutor_profile" ADD COLUMN "offers_intro" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tutor_profile" ADD COLUMN "accepts_cash" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "child" ADD CONSTRAINT "child_parent_id_user_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourite" ADD CONSTRAINT "favourite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourite" ADD CONSTRAINT "favourite_tutor_id_user_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_pref" ADD CONSTRAINT "notification_pref_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_request" ADD CONSTRAINT "support_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "child_parent_idx" ON "child" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_subject_name" ON "platform_subject" USING btree ("name");--> statement-breakpoint
-- A starting list of common subjects in Zimbabwe (the owner can change it in Tutora admin).
INSERT INTO "platform_subject" ("name","sort_order") VALUES
('Mathematics',1),('English Language',2),('Physics',3),('Chemistry',4),('Biology',5),('Combined Science',6),('Geography',7),('History',8),('Shona',9),('Ndebele',10),('Accounting',11),('Business Studies',12),('Economics',13),('Computer Science',14),('Literature in English',15),('Agriculture',16),('Additional Mathematics',17),('Pure Mathematics',18),('Statistics',19),('French',20)
ON CONFLICT DO NOTHING;
