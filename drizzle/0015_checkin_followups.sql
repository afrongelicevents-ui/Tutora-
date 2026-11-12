CREATE TABLE "checkin_followup_sent" (
	"checkin_id" integer PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkin_pref" (
	"student_id" text PRIMARY KEY NOT NULL,
	"share_with_family" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_summary_sent" (
	"student_id" text NOT NULL,
	"on_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_summary_sent_student_id_on_date_pk" PRIMARY KEY("student_id","on_date")
);
--> statement-breakpoint
ALTER TABLE "checkin" ADD COLUMN "kind" text DEFAULT 'start' NOT NULL;--> statement-breakpoint
ALTER TABLE "checkin" ADD COLUMN "followup_of" integer;--> statement-breakpoint
ALTER TABLE "checkin_followup_sent" ADD CONSTRAINT "checkin_followup_sent_checkin_id_checkin_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_pref" ADD CONSTRAINT "checkin_pref_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_summary_sent" ADD CONSTRAINT "day_summary_sent_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;